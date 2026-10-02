import { NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { PORTFOLIO_POLICY_VERSION, normalizePortfolioFields } from "@/lib/server/portfolio";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiUser } from "@/lib/server/api-auth";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user; const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const consent = await prisma.portfolioShareConsent.findUnique({ where: { userId: user.id } });
  // No stored row means nothing has been acknowledged yet, so the fallback must not
  // pre-fill the policy version or the UI renders a pre-ticked consent checkbox.
  return NextResponse.json(consent ?? { mode: "PRIVATE", status: "ACTIVE", fieldAllowlist: [], policyVersion: "" });
}
export async function PUT(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof NextResponse) return user; const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json().catch(() => null); const fields = normalizePortfolioFields(body?.fieldAllowlist);
  // PUBLIC_PROFILE is absent on purpose: it has no reader (no public profile page) and the
  // share-link resolver only serves DIRECT_SHARE. The DB enum keeps the value, so a legacy
  // row just reads as "no radio selected" until the owner picks a valid mode again.
  if (!body || !["PRIVATE", "DIRECT_SHARE"].includes(body.mode) || !fields || body.policyVersion !== PORTFOLIO_POLICY_VERSION) return NextResponse.json({ error: "Invalid consent." }, { status: 400 });
  const consent = await prisma.portfolioShareConsent.upsert({ where: { userId: user.id }, create: { userId: user.id, mode: body.mode, status: body.mode === "PRIVATE" ? "REVOKED" : "ACTIVE", fieldAllowlist: body.mode === "PRIVATE" ? [] : fields, policyVersion: PORTFOLIO_POLICY_VERSION, revokedAt: body.mode === "PRIVATE" ? new Date() : null }, update: { mode: body.mode, status: body.mode === "PRIVATE" ? "REVOKED" : "ACTIVE", fieldAllowlist: body.mode === "PRIVATE" ? [] : fields, policyVersion: PORTFOLIO_POLICY_VERSION, revokedAt: body.mode === "PRIVATE" ? new Date() : null } });
  await writeCoreAuditLog({ actorUserId: user.id, action: "PORTFOLIO_CONSENT_UPDATED", subjectType: "PortfolioShareConsent", subjectId: consent.id, result: "SUCCESS", ...getRequestAuditContext(request) });
  return NextResponse.json(consent);
}
