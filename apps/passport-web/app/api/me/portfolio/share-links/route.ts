import { NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { newShareToken, normalizePortfolioFields, PORTFOLIO_POLICY_VERSION } from "@/lib/server/portfolio";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiUser } from "@/lib/server/api-auth";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user; const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const links = await prisma.portfolioShareLink.findMany({ where: { userId: user.id }, select: { id: true, expiresAt: true, maxAccessCount: true, accessCount: true, status: true, revokedAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ links });
}

export async function POST(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof NextResponse) return user; const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json().catch(() => null); const fields = normalizePortfolioFields(body?.fieldAllowlist); const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  if (!fields || body?.policyVersion !== PORTFOLIO_POLICY_VERSION || !expiresAt || Number.isNaN(+expiresAt) || expiresAt <= new Date() || (body.maxAccessCount != null && (!Number.isInteger(body.maxAccessCount) || body.maxAccessCount < 1))) return NextResponse.json({ error: "Invalid share link." }, { status: 400 });
  // The resolver only serves links while consent is DIRECT_SHARE/ACTIVE and projects
  // link.fieldAllowlist, so a link must stay inside the stored consent scope.
  const consent = await prisma.portfolioShareConsent.findUnique({ where: { userId: user.id } });
  if (!consent || consent.status !== "ACTIVE" || consent.mode !== "DIRECT_SHARE" || consent.policyVersion !== PORTFOLIO_POLICY_VERSION || (consent.expiresAt && consent.expiresAt <= new Date())) return NextResponse.json({ error: "Direct share consent is required before creating a link." }, { status: 403 });
  const allowedFields = fields.filter((field) => consent.fieldAllowlist.includes(field));
  if (!allowedFields.length) return NextResponse.json({ error: "Select at least one field covered by your sharing consent." }, { status: 400 });
  const { token, tokenHash } = newShareToken(); const link = await prisma.portfolioShareLink.create({ data: { userId: user.id, tokenHash, fieldAllowlist: allowedFields, policyVersion: PORTFOLIO_POLICY_VERSION, expiresAt, maxAccessCount: body.maxAccessCount ?? null } });
  await writeCoreAuditLog({ actorUserId: user.id, action: "PORTFOLIO_SHARE_LINK_GRANTED", subjectType: "PortfolioShareLink", subjectId: link.id, result: "SUCCESS", ...getRequestAuditContext(request), metadataJson: { fieldAllowlist: allowedFields } });
  // Raw token is intentionally returned exactly once, and only the fields the sharing
  // UI needs are echoed back — never tokenHash or the owning userId.
  return NextResponse.json({ id: link.id, token, expiresAt: link.expiresAt, accessCount: link.accessCount, maxAccessCount: link.maxAccessCount, status: link.status });
}
