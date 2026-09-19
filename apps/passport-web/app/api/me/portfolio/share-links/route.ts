import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { newShareToken, normalizePortfolioFields, PORTFOLIO_POLICY_VERSION } from "@/lib/server/portfolio";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET() {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/portfolio"); const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const links = await prisma.portfolioShareLink.findMany({ where: { userId: user.id }, select: { id: true, expiresAt: true, maxAccessCount: true, accessCount: true, status: true, revokedAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ links });
}

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/portfolio"); const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json().catch(() => null); const fields = normalizePortfolioFields(body?.fieldAllowlist); const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  if (!fields || body?.policyVersion !== PORTFOLIO_POLICY_VERSION || !expiresAt || Number.isNaN(+expiresAt) || expiresAt <= new Date() || (body.maxAccessCount != null && (!Number.isInteger(body.maxAccessCount) || body.maxAccessCount < 1))) return NextResponse.json({ error: "Invalid share link." }, { status: 400 });
  const { token, tokenHash } = newShareToken(); const link = await prisma.portfolioShareLink.create({ data: { userId: user.id, tokenHash, fieldAllowlist: fields, policyVersion: PORTFOLIO_POLICY_VERSION, expiresAt, maxAccessCount: body.maxAccessCount ?? null } });
  await writeCoreAuditLog({ actorUserId: user.id, action: "PORTFOLIO_SHARE_LINK_GRANTED", subjectType: "PortfolioShareLink", subjectId: link.id, result: "SUCCESS", ...getRequestAuditContext(request) });
  return NextResponse.json({ ...link, token }); // Raw token is intentionally returned exactly once.
}
