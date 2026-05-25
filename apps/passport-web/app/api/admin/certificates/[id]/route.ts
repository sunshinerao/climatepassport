import { NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const issue = await prisma.certificateIssue.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, verificationCode: true },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  await prisma.certificateIssue.delete({ where: { id: issue.id } });

  await writeCoreAuditLog({
    actorUserId: admin.id,
    action: "certificate.delete",
    subjectType: "certificate_issue",
    subjectId: issue.id,
    result: "deleted",
    metadataJson: {
      previousStatus: issue.status,
      verificationCode: issue.verificationCode,
    },
    ...getRequestAuditContext(request),
  });

  return NextResponse.json({ ok: true, id: issue.id });
}
