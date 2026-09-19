import { NextResponse } from "next/server";
import { ExternalLearningAccountPayloadSchema, ExternalLearningAccountUpdateSchema, ExternalLearningAdminListQuerySchema } from "@climate-passport/passport-contracts";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { sha256Reference } from "@/lib/server/external-learning";

async function requireAdmin() { const user = await getCurrentUser(); return user?.role === "ADMIN" ? user : null; }
export async function GET(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 403 });
  const query = ExternalLearningAdminListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams)); if (!query.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 });
  const rows = await prisma.externalLearningAccount.findMany({ take: query.data.limit + 1, ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}), orderBy: { id: "asc" }, select: { id: true, providerId: true, userId: true, externalSubjectHash: true, status: true, verifiedAt: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ items: rows.slice(0, query.data.limit), nextCursor: rows.length > query.data.limit ? rows[query.data.limit]?.id : null });
}
export async function POST(request: Request) {
  const admin = await requireAdmin(); if (!admin) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 403 });
  const body = ExternalLearningAccountPayloadSchema.safeParse(await request.json().catch(() => null)); if (!body.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 });
  const [provider, user] = await Promise.all([prisma.externalLearningProvider.findUnique({ where: { id: body.data.providerId }, select: { id: true } }), prisma.user.findUnique({ where: { id: body.data.userId }, select: { id: true } })]);
  if (!provider || !user) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  try { const account = await prisma.externalLearningAccount.create({ data: { providerId: body.data.providerId, userId: body.data.userId, externalSubjectHash: sha256Reference(body.data.externalSubjectId), status: body.data.status, verifiedAt: body.data.status === "VERIFIED" ? new Date() : null } }); await writeCoreAuditLog({ actorUserId: admin.id, action: "EXTERNAL_LEARNING_ACCOUNT_CREATED", subjectType: "ExternalLearningAccount", subjectId: account.id, result: "SUCCESS", metadataJson: { providerId: account.providerId, status: account.status }, ...getRequestAuditContext(request) }); return NextResponse.json({ account }, { status: 201 }); } catch { return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 409 }); }
}
export async function PATCH(request: Request) {
  const admin = await requireAdmin(); if (!admin) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 403 }); const body = ExternalLearningAccountUpdateSchema.safeParse(await request.json().catch(() => null)); if (!body.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 }); const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 });
  try { const account = await prisma.externalLearningAccount.update({ where: { id: body.data.id }, data: body.data.action === "VERIFY" ? { status: "VERIFIED", verifiedAt: new Date() } : { status: "DISABLED" } }); await writeCoreAuditLog({ actorUserId: admin.id, action: `EXTERNAL_LEARNING_ACCOUNT_${body.data.action}D`, subjectType: "ExternalLearningAccount", subjectId: account.id, result: "SUCCESS", metadataJson: { providerId: account.providerId, status: account.status }, ...getRequestAuditContext(request) }); return NextResponse.json({ account }); } catch { return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 404 }); }
}
