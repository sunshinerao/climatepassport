import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { PORTFOLIO_POLICY_VERSION, normalizePortfolioFields } from "@/lib/server/portfolio";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET() {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/portfolio"); const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const consent = await prisma.portfolioShareConsent.findUnique({ where: { userId: user.id } });
  return NextResponse.json(consent ?? { mode: "PRIVATE", status: "ACTIVE", fieldAllowlist: [], policyVersion: PORTFOLIO_POLICY_VERSION });
}
export async function PUT(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/portfolio"); const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json().catch(() => null); const fields = normalizePortfolioFields(body?.fieldAllowlist);
  if (!body || !["PRIVATE", "PUBLIC_PROFILE", "DIRECT_SHARE"].includes(body.mode) || !fields || body.policyVersion !== PORTFOLIO_POLICY_VERSION) return NextResponse.json({ error: "Invalid consent." }, { status: 400 });
  const consent = await prisma.portfolioShareConsent.upsert({ where: { userId: user.id }, create: { userId: user.id, mode: body.mode, status: body.mode === "PRIVATE" ? "REVOKED" : "ACTIVE", fieldAllowlist: body.mode === "PRIVATE" ? [] : fields, policyVersion: PORTFOLIO_POLICY_VERSION, revokedAt: body.mode === "PRIVATE" ? new Date() : null }, update: { mode: body.mode, status: body.mode === "PRIVATE" ? "REVOKED" : "ACTIVE", fieldAllowlist: body.mode === "PRIVATE" ? [] : fields, policyVersion: PORTFOLIO_POLICY_VERSION, revokedAt: body.mode === "PRIVATE" ? new Date() : null } });
  await writeCoreAuditLog({ actorUserId: user.id, action: "PORTFOLIO_CONSENT_UPDATED", subjectType: "PortfolioShareConsent", subjectId: consent.id, result: "SUCCESS", ...getRequestAuditContext(request) });
  return NextResponse.json(consent);
}
