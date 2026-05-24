import { NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { canRestoreCertificateStatus } from "@/lib/server/certificates";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
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
    select: { id: true, status: true },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  if (!canRestoreCertificateStatus(issue.status)) {
    return NextResponse.json({ error: "Only revoked certificates can be restored." }, { status: 409 });
  }

  await prisma.certificateIssue.update({
    where: { id: issue.id },
    data: { status: "ISSUED" },
  });

  await writeCoreAuditLog({
    actorUserId: admin.id,
    action: "certificate.restore",
    subjectType: "certificate_issue",
    subjectId: issue.id,
    result: "restored",
    metadataJson: { previousStatus: issue.status },
    ...getRequestAuditContext(request),
  });

  return NextResponse.json({ ok: true });
}
