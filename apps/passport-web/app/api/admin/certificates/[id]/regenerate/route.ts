import { NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { renderCertificateHtml } from "@/lib/server/certificate-module";
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
    include: {
      user: { select: { name: true } },
      definition: { include: { category: true } },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  const fileName = `${issue.verificationCode ?? issue.id}.html`;
  const html = renderCertificateHtml({
    holderName: issue.user.name,
    certificateName: issue.definition.nameEn ?? issue.definition.name,
    categoryName: issue.definition.category.nameEn ?? issue.definition.category.name,
    issueDate: (issue.issuedAt ?? issue.createdAt).toISOString().slice(0, 10),
    certificateNumber: issue.verificationCode ?? issue.id,
  });
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  await prisma.certificateIssue.update({
    where: { id: issue.id },
    data: {
      generatedFileName: fileName,
      generatedFileUrl: dataUrl,
      status: issue.status === "DRAFT" ? "GENERATED" : issue.status,
    },
  });

  await writeCoreAuditLog({
    actorUserId: admin.id,
    action: "certificate.regenerate",
    subjectType: "certificate_issue",
    subjectId: issue.id,
    result: "generated",
    metadataJson: { fileName },
    ...getRequestAuditContext(request),
  });

  return NextResponse.json({ ok: true, fileName });
}
