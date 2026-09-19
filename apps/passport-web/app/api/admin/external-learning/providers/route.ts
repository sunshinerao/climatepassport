import { NextResponse } from "next/server";
import { ExternalLearningAdminListQuerySchema, ExternalLearningProviderPayloadSchema } from "@climate-passport/passport-contracts";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";

function admin() { return getCurrentUser().then((user) => user?.role === "ADMIN" ? user : null); }
export async function GET(request: Request) {
  if (!await admin()) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 403 });
  const query = ExternalLearningAdminListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams)); if (!query.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 });
  const rows = await prisma.externalLearningProvider.findMany({ take: query.data.limit + 1, ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}), orderBy: { id: "asc" }, select: { id: true, key: true, webhookPathKey: true, displayName: true, status: true, signingSecretRef: true, verificationConfigJson: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ items: rows.slice(0, query.data.limit), nextCursor: rows.length > query.data.limit ? rows[query.data.limit]?.id : null });
}
export async function POST(request: Request) {
  const user = await admin(); if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 403 });
  const body = ExternalLearningProviderPayloadSchema.safeParse(await request.json().catch(() => null)); if (!body.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 });
  if (body.data.status === "ACTIVE" && (!body.data.signingSecretRef || !body.data.verificationConfig)) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  try { const provider = await prisma.externalLearningProvider.create({ data: { ...body.data, verificationConfigJson: body.data.verificationConfig } }); await writeCoreAuditLog({ actorUserId: user.id, action: "EXTERNAL_LEARNING_PROVIDER_CREATED", subjectType: "ExternalLearningProvider", subjectId: provider.id, result: "SUCCESS", metadataJson: { providerKey: provider.key, status: provider.status }, ...getRequestAuditContext(request) }); return NextResponse.json({ provider }, { status: 201 }); } catch { return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 409 }); }
}
