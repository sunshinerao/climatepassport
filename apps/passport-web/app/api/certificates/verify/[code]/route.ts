import { NextResponse } from "next/server";
import { getRequestAuditContext } from "@/lib/server/audit";
import { serializePublicCertificateVerification } from "@/lib/server/certificates";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const code = params.code.trim();
  const auditContext = getRequestAuditContext(request);
  const issue = await prisma.certificateIssue.findUnique({
    where: { verificationCode: code },
    include: {
      user: { select: { name: true, climatePassportId: true } },
      definition: {
        select: {
          name: true,
          nameEn: true,
          verificationMode: true,
          category: { select: { name: true, nameEn: true } },
        },
      },
    },
  });

  if (!issue) {
    return NextResponse.json({ valid: false, result: "NOT_FOUND" }, { status: 404 });
  }

  const result = issue.status === "REVOKED" ? "REVOKED" : issue.status === "ISSUED" ? "VALID" : "INVALID";

  await prisma.certificateVerification.create({
    data: {
      certificateIssueId: issue.id,
      verificationChannel: "PUBLIC_API",
      result,
      metadataJson: auditContext,
    },
  });

  return NextResponse.json(serializePublicCertificateVerification(issue));
}
