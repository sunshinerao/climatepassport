import { createHash, randomBytes } from "crypto";
import type { PortfolioEvidenceSourceKind } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";

export const PORTFOLIO_POLICY_VERSION = "portfolio-sharing-v1";
export const PORTFOLIO_FIELDS = ["name", "title", "dimensions", "evidence"] as const;
export type PortfolioField = (typeof PORTFOLIO_FIELDS)[number];
type EvidenceItem = { key: string; source: PortfolioEvidenceSourceKind; title: string; type?: string; certificateCode: string | null };

const allowedSourceKinds = new Set<PortfolioEvidenceSourceKind>([
  "ISSUED_CERTIFICATE", "VERIFIED_ACHIEVEMENT", "LEARNING_COMPLETION", "VERIFIED_ACTIVITY_PARTICIPATION",
]);

export function normalizePortfolioFields(value: unknown): PortfolioField[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const fields = [...new Set(value)];
  return fields.every((field) => typeof field === "string" && PORTFOLIO_FIELDS.includes(field as PortfolioField))
    ? fields as PortfolioField[] : null;
}

function titleFor(locale: "en" | "zh", source: { name?: string; nameEn?: string | null; title?: string; titleEn?: string | null }) {
  return locale === "zh" ? (source.name ?? source.title ?? source.nameEn ?? source.titleEn ?? "Verified record") : (source.nameEn ?? source.titleEn ?? source.name ?? source.title ?? "Verified record");
}
function matchesPredicate(predicate: unknown, evidence: unknown) {
  const typedEvidence = evidence as { type?: string | null };
  return !predicate || typeof predicate !== "object" || !("type" in predicate) || (predicate as { type?: string }).type === typedEvidence.type;
}
function band(count: number) { return count === 0 ? "NONE" : count === 1 ? "FOUNDATIONAL" : count < 4 ? "DEVELOPING" : "ESTABLISHED"; }

/** Pure request-time derivation: only explicit verified source records are queried. */
export async function derivePortfolio(userId: string, locale: "en" | "zh" = "en") {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable.");
  const ruleSet = await prisma.portfolioRuleSet.findFirst({ where: { status: "ACTIVE" }, orderBy: { version: "desc" }, include: { evidenceRules: { include: { dimension: true } } } });
  if (!ruleSet) return { ruleVersion: null, dimensions: [] };
  const rules = ruleSet.evidenceRules.filter((rule) => allowedSourceKinds.has(rule.sourceKind));
  const [certificates, achievements, learning, participations] = await Promise.all([
    prisma.certificateIssue.findMany({ where: { userId, status: "ISSUED" }, include: { definition: true } }),
    prisma.achievement.findMany({ where: { userId, status: "APPROVED", verificationLevel: "PLATFORM_VERIFIED" } }),
    prisma.learningExperienceParticipation.findMany({ where: { userId, status: "COMPLETED", OR: [{ certificateIssue: { status: "ISSUED" } }, { outcomeSummary: { not: null } }] }, include: { program: true } }),
    prisma.activityParticipation.findMany({ where: { userId, OR: [{ certificateIssueId: { not: null } }, { activity: { checkinRecords: { some: { userId, status: "VALID", verifiedByUserId: { not: null } } } } }] }, include: { activity: true } }),
  ]);
  const evidence: EvidenceItem[] = [
    ...certificates.map((x) => ({ key: `certificate:${x.id}`, source: "ISSUED_CERTIFICATE" as const, title: titleFor(locale, x.definition), certificateCode: x.publicVisible ? x.verificationCode : null })),
    ...achievements.map((x) => ({ key: `achievement:${x.id}`, source: "VERIFIED_ACHIEVEMENT" as const, title: x.name, type: x.type, certificateCode: null })),
    ...learning.map((x) => ({ key: `learning:${x.id}`, source: "LEARNING_COMPLETION" as const, title: titleFor(locale, x.program), certificateCode: null })),
    ...participations.map((x) => ({ key: `activity:${x.id}`, source: "VERIFIED_ACTIVITY_PARTICIPATION" as const, title: titleFor(locale, x.activity), certificateCode: null })),
  ];
  const dimensions = ruleSet.evidenceRules.map((rule) => rule.dimension).filter((dimension, index, values) => values.findIndex((x) => x.id === dimension.id) === index).sort((a, b) => a.sortOrder - b.sortOrder).map((dimension) => {
    const included = new Map<string, { evidenceKey: string; title: string; sourceKind: string; certificateVerificationUrl: string | null; explanation: string }>();
    rules.filter((rule) => rule.dimensionId === dimension.id).forEach((rule) => evidence.filter((item) => item.source === rule.sourceKind && matchesPredicate(rule.predicateJson, item)).forEach((item) => {
      // The stable source key prevents cross-rule double counting unless a future explicit distinct rule is introduced.
      if (!included.has(item.key)) included.set(item.key, { evidenceKey: `evidence-${createHash("sha256").update(item.key).digest("hex").slice(0, 24)}`, title: item.title, sourceKind: item.source, certificateVerificationUrl: item.certificateCode ? `/api/certificates/verify/${encodeURIComponent(item.certificateCode)}` : null, explanation: locale === "zh" ? rule.reason : (rule.reasonEn ?? rule.reason) });
    }));
    const records = [...included.values()];
    return { key: dimension.key, title: titleFor(locale, dimension), evidenceCount: records.length, band: band(records.length), explanation: records.length ? (locale === "zh" ? "基于当前已验证记录。" : "Based on current verified records.") : (locale === "zh" ? "暂无符合当前规则的已验证记录。" : "No verified records meet the current rules."), evidence: records };
  });
  return { ruleVersion: ruleSet.version, dimensions };
}

export function newShareToken() { const token = randomBytes(32).toString("base64url"); return { token, tokenHash: createHash("sha256").update(token).digest("hex") }; }
export function hashShareToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

/** Claims a share link once, including atomically enforcing revocation, expiry and its cap. */
export async function resolvePublicPortfolioShare(token: string, locale: "en" | "zh") {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable.");
  const now = new Date();
  const tokenHash = hashShareToken(token);
  const link = await prisma.portfolioShareLink.findUnique({ where: { tokenHash }, include: { user: { select: { name: true, title: true, portfolioShareConsent: true } } } });
  const consent = link?.user.portfolioShareConsent;
  if (!link || !consent || consent.mode !== "DIRECT_SHARE" || consent.status !== "ACTIVE" || consent.expiresAt && consent.expiresAt <= now || link.status !== "ACTIVE" || link.expiresAt <= now || (link.maxAccessCount !== null && link.accessCount >= link.maxAccessCount) || link.policyVersion !== PORTFOLIO_POLICY_VERSION || consent.policyVersion !== PORTFOLIO_POLICY_VERSION) return null;
  const claimed = await prisma.$executeRaw`UPDATE "portfolio_share_links" SET "accessCount" = "accessCount" + 1 WHERE "id" = ${link.id} AND "status" = 'ACTIVE' AND "expiresAt" > ${now} AND ("maxAccessCount" IS NULL OR "accessCount" < "maxAccessCount")`;
  if (claimed !== 1) return null;
  const portfolio = await derivePortfolio(link.userId, locale);
  const fields = new Set(link.fieldAllowlist);
  return { ...(fields.has("name") ? { name: link.user.name } : {}), ...(fields.has("title") && link.user.title ? { title: link.user.title } : {}), ...(fields.has("dimensions") ? { dimensions: portfolio.dimensions.map((dimension) => ({ key: dimension.key, title: dimension.title, evidenceCount: dimension.evidenceCount, band: dimension.band, explanation: dimension.explanation, ...(fields.has("evidence") ? { evidence: dimension.evidence } : {}) })) } : {}), ruleVersion: portfolio.ruleVersion };
}
