import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const revokeSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = revokeSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const issue = await prisma.certificateIssue.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  await prisma.certificateIssue.update({
    where: { id: issue.id },
    data: { status: "REVOKED" },
  });

  await writeCoreAuditLog({
    actorUserId: admin.id,
    action: "certificate.revoke",
    subjectType: "certificate_issue",
    subjectId: issue.id,
    result: "revoked",
    metadataJson: { reason: payload.data.reason ?? null },
    ...getRequestAuditContext(request),
  });

  return NextResponse.json({ ok: true });
}
