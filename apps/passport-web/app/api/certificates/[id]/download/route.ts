import { NextResponse } from "next/server";
import { canDownloadCertificateStatus } from "@/lib/server/certificates";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiUser } from "@/lib/server/api-auth";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireApiUser(request);
  if (user instanceof NextResponse) return user;
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
      downloadCount: true,
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

  return NextResponse.json({
    ok: true,
    download: {
      url: `/api/certificates/${encodeURIComponent(issue.id)}/artifact?disposition=attachment`,
      fileName: issue.generatedFileName,
      verificationCode: issue.verificationCode,
      downloadCount: issue.downloadCount,
    },
  });
}
