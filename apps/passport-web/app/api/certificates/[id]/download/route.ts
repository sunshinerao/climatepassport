import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { canDownloadCertificateStatus } from "@/lib/server/certificates";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireAuthenticatedUser("en", "/en/certificates");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const issue = await prisma.certificateIssue.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      status: true,
      generatedFileUrl: true,
      generatedFileName: true,
      verificationCode: true,
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  if (issue.userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canDownloadCertificateStatus(issue.status)) {
    return NextResponse.json({ error: "Certificate is not downloadable." }, { status: 409 });
  }

  const updated = await prisma.certificateIssue.update({
    where: { id: issue.id },
    data: { downloadCount: { increment: 1 } },
    select: { downloadCount: true },
  });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "certificate.download",
    subjectType: "certificate_issue",
    subjectId: issue.id,
    result: "download_authorized",
    metadataJson: { fileName: issue.generatedFileName ?? null },
    ...getRequestAuditContext(request),
  });

  return NextResponse.json({
    ok: true,
    download: {
      url: issue.generatedFileUrl,
      fileName: issue.generatedFileName,
      verificationCode: issue.verificationCode,
      downloadCount: updated.downloadCount,
    },
  });
}
