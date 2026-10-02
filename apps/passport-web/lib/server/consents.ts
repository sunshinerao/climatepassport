import { eraseAppOutcomeConsent } from "./app-outcome-consent-erasure";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * CP-TODO-249：多目的同意、监护链接、撤回（CP-FR-060）。
 *
 * 原则：
 * - 目的彼此独立（账户条款/项目运行/影像/署名/联系/推荐宣传分别授予），
 *   一个目的或频道的同意不授权其他目的或频道（FS 公开 ≠ 其他频道授权）。
 * - 监护/代授：grantor ≠ subject 时必须声明 guardianUserId == grantor 并附
 *   验证依据 evidenceJson（联系邮箱不构成授权，CP-FR-060）；身份核验本身是
 *   Programme 职责，CP 只保存最小证据。
 * - 同一范围（subject × purpose × channel × object）再次授予产生新版本，
 *   旧版本置 SUPERSEDED；撤回（WITHDRAWN）立即生效并阻断依赖它的发布。
 * - 有效期窗口 validFrom/validUntil；过期视同无同意。
 * - 关键写入与审计同一事务提交（CP-AUD-005）。
 */

export type ConsentError = { error: string; status: number; code: string };

type PrismaLike = Pick<PrismaClient,
  | "consentRecord"
  | "programme"
  | "user"
  | "coreAuditLog"> & {
    $transaction: PrismaClient["$transaction"];
  };

export const CONSENT_STATUSES = ["ACTIVE", "WITHDRAWN", "SUPERSEDED"] as const;

function consentError(error: string, status: number, code: string): ConsentError {
  return { error, status, code };
}

function normalizeChannel(channel?: string | null) {
  return channel?.trim().toLowerCase() || null;
}

function windowConditions(now: Date) {
  // validFrom 非空（默认 CURRENT_TIMESTAMP），仅校验窗口起点已生效。
  return {
    AND: [
      { validFrom: { lte: now } },
      { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    ],
  };
}

interface ConsentScope {
  subjectUserId: string;
  purpose: string;
  channel: string | null;
  objectType: string | null;
  objectId: string | null;
}

function sameScope(scope: ConsentScope) {
  return {
    subjectUserId: scope.subjectUserId,
    purpose: scope.purpose,
    channel: scope.channel,
    objectType: scope.objectType,
    objectId: scope.objectId,
  };
}

/** 授予同意：本人自授，或监护人/代授（须附验证依据）。新版本取代同范围旧版本。 */
export async function grantConsent(
  prisma: PrismaLike,
  input: {
    grantorUserId: string;
    subjectUserId: string;
    purpose: string;
    channel?: string | null;
    programmeId?: string | null;
    objectType?: string | null;
    objectId?: string | null;
    validFrom?: Date | null;
    validUntil?: Date | null;
    guardianUserId?: string | null;
    evidenceJson?: Record<string, unknown> | null;
  },
): Promise<{ consentId: string; version: number } | ConsentError> {
  const isSelfGrant = input.grantorUserId === input.subjectUserId;
  if (!isSelfGrant) {
    if (input.guardianUserId !== input.grantorUserId || !input.guardianUserId) {
      return consentError("Guardian grants require guardianUserId equal to the grantor.", 400, "GUARDIAN_LINK_REQUIRED");
    }
    if (!input.evidenceJson || Object.keys(input.evidenceJson).length === 0) {
      return consentError("Guardian grants require verified evidence (evidenceJson).", 400, "GUARDIAN_LINK_REQUIRED");
    }
  }
  if (input.validFrom && input.validUntil && input.validUntil <= input.validFrom) {
    return consentError("validUntil must be after validFrom.", 400, "INVALID_REQUEST");
  }

  const [subject, grantor] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.subjectUserId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: input.grantorUserId }, select: { id: true } }),
  ]);
  if (!subject) return consentError("Subject account not found.", 404, "CONSENT_NOT_FOUND");
  if (!grantor) return consentError("Grantor account not found.", 404, "CONSENT_NOT_FOUND");
  if (input.programmeId) {
    const programme = await prisma.programme.findFirst({ where: { id: input.programmeId, isActive: true }, select: { id: true } });
    if (!programme) return consentError("Programme not found or inactive.", 404, "CONSENT_NOT_FOUND");
  }

  const scope: ConsentScope = {
    subjectUserId: input.subjectUserId,
    purpose: input.purpose,
    channel: normalizeChannel(input.channel),
    objectType: input.objectType?.trim() || null,
    objectId: input.objectId?.trim() || null,
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.consentRecord.findMany({
        where: { ...sameScope(scope) },
        select: { version: true },
      });
      const version = existing.reduce((max, row) => Math.max(max, row.version), 0) + 1;

      const retiring = input.purpose === "private_archive" ? await tx.consentRecord.findMany({ where: { ...sameScope(scope), status: "ACTIVE" }, select: { id: true } }) : [];
      await tx.consentRecord.updateMany({
        where: { ...sameScope(scope), status: "ACTIVE" },
        data: { status: "SUPERSEDED" },
      });

      for (const prior of retiring) await eraseAppOutcomeConsent(tx, prior.id);
      const consent = await tx.consentRecord.create({
        data: {
          subjectUserId: scope.subjectUserId,
          grantorUserId: input.grantorUserId,
          purpose: scope.purpose,
          channel: scope.channel,
          programmeId: input.programmeId ?? null,
          objectType: scope.objectType,
          objectId: scope.objectId,
          version,
          status: "ACTIVE",
          guardianUserId: isSelfGrant ? null : input.guardianUserId,
          validFrom: input.validFrom ?? undefined,
          validUntil: input.validUntil ?? null,
          evidenceJson: (isSelfGrant ? undefined : input.evidenceJson) as Prisma.InputJsonValue | undefined,
        },
        select: { id: true, version: true },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.grantorUserId,
          action: "consent.grant",
          subjectType: "consent",
          subjectId: consent.id,
          result: "granted",
          metadataJson: {
            subjectUserId: scope.subjectUserId,
            purpose: scope.purpose,
            channel: scope.channel,
            objectType: scope.objectType,
            objectId: scope.objectId,
            version,
            viaGuardian: !isSelfGrant,
          },
        },
      });
      return { consentId: consent.id, version: consent.version };
    });
  } catch (error) {
    console.error("consent grant failed:", error);
    return consentError("Consent grant failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 撤回同意：本人或原授予人（监护人）可撤回；立即生效。 */
export async function withdrawConsent(
  prisma: PrismaLike,
  input: { consentId: string; actorUserId: string },
): Promise<{ consentId: string } | ConsentError> {
  const consent = await prisma.consentRecord.findUnique({
    where: { id: input.consentId },
    select: { id: true, subjectUserId: true, grantorUserId: true, status: true, purpose: true },
  });
  if (!consent) return consentError("Consent not found.", 404, "CONSENT_NOT_FOUND");
  if (consent.subjectUserId !== input.actorUserId && consent.grantorUserId !== input.actorUserId) {
    return consentError("Forbidden", 403, "RECORD_ACCESS_DENIED");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.consentRecord.updateMany({
        where: { id: consent.id, status: "ACTIVE" },
        data: { status: "WITHDRAWN", withdrawnAt: new Date() },
      });
      if (updated.count !== 1) return consentError("Consent is no longer active.", 409, "CONSENT_WITHDRAWN");
      if (consent.purpose === "private_archive") await eraseAppOutcomeConsent(tx, consent.id);
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "consent.withdraw",
          subjectType: "consent",
          subjectId: consent.id,
          result: "withdrawn",
          metadataJson: { subjectUserId: consent.subjectUserId },
        },
      });
      return { consentId: consent.id };
    });
  } catch (error) {
    console.error("consent withdraw failed:", error);
    return consentError("Consent withdraw failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/**
 * 解析有效同意：同一 subject × purpose 最新 ACTIVE 版本；频道规则为
 * consent.channel 为空（不限频道）或精确匹配；对象规则为空对象（通用）或精确匹配。
 * 返回 null 表示无有效同意（未授予、已撤回、被取代或过期）。
 */
export async function resolveConsent(
  prisma: Pick<PrismaClient, "consentRecord">,
  input: {
    subjectUserId: string;
    purpose: string;
    channel?: string | null;
    objectType?: string | null;
    objectId?: string | null;
    at?: Date;
  },
): Promise<{ consent: Record<string, unknown> | null }> {
  const now = input.at ?? new Date();
  const rows = await prisma.consentRecord.findMany({
    where: {
      subjectUserId: input.subjectUserId,
      purpose: input.purpose,
      status: "ACTIVE",
      ...windowConditions(now),
    },
    orderBy: { version: "desc" },
    take: 20,
  });

  const channel = normalizeChannel(input.channel);
  const objectType = input.objectType?.trim() || null;
  const objectId = input.objectId?.trim() || null;
  const match = rows.find((row) => {
    if (row.channel !== null && row.channel !== channel) return false;
    if (row.objectType !== null && row.objectType !== objectType) return false;
    if (row.objectId !== null && row.objectId !== objectId) return false;
    return true;
  });
  return { consent: match ? (match as unknown as Record<string, unknown>) : null };
}

/** 查询主体可见的同意：本人或该主体的授予人（监护人）。 */
export async function listConsentsForSubject(
  prisma: Pick<PrismaClient, "consentRecord">,
  input: { subjectUserId: string; actorUserId: string; purpose?: string; status?: string },
): Promise<{ consents: Array<Record<string, unknown>> } | ConsentError> {
  if (input.subjectUserId !== input.actorUserId) {
    const granted = await prisma.consentRecord.findFirst({
      where: { subjectUserId: input.subjectUserId, grantorUserId: input.actorUserId },
      select: { id: true },
    });
    if (!granted) return consentError("Forbidden", 403, "RECORD_ACCESS_DENIED");
  }
  const consents = await prisma.consentRecord.findMany({
    where: {
      subjectUserId: input.subjectUserId,
      ...(input.purpose ? { purpose: input.purpose } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ purpose: "asc" }, { version: "desc" }],
    take: 200,
  });
  return { consents: consents as unknown as Array<Record<string, unknown>> };
}
