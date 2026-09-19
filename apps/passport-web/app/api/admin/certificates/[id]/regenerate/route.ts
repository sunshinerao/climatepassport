import { NextResponse } from "next/server";
import { getRequestAuditContext } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { buildCertificatePdfArtifactWithQr } from "@/lib/server/certificate-module";
import { storeBuiltCertificateArtifact } from "@/lib/server/certificate-artifact-storage";
import { parseCertificateRenderSnapshot } from "@/lib/server/certificate-snapshot";
import {
  canRegenerateCertificateStatus,
  getCertificateStatusAfterRegeneration,
} from "@/lib/server/certificates";
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
    select: { id: true, status: true, verificationCode: true, issuedAt: true, createdAt: true, variableValuesJson: true, renderSnapshotJson: true },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  if (!canRegenerateCertificateStatus(issue.status)) {
    return NextResponse.json({ error: "Revoked certificates cannot be regenerated." }, { status: 409 });
  }

  const snapshot = parseCertificateRenderSnapshot(issue.renderSnapshotJson);
  if (!snapshot) {
    return NextResponse.json({ error: "This legacy certificate has no valid rendering snapshot. Reissue it instead." }, { status: 409 });
  }
  const certificateNumber = issue.verificationCode ?? issue.id;
  const verificationUrl = new URL(`/verify/certificate/${encodeURIComponent(certificateNumber)}`, request.url).toString();
  const variableValues = {
    ...snapshot.variableValues,
    certificateNumber,
    verificationUrl,
  };
  const artifact = await buildCertificatePdfArtifactWithQr({
    holderName: snapshot.holderName,
    certificateName: snapshot.certificateName,
    categoryName: snapshot.categoryName,
    issueDate: issue.issuedAt ?? issue.createdAt,
    certificateNumber,
    verificationUrl,
    renderConfigJson: snapshot.renderConfigJson,
    variableValues,
  });

  let artifactStorage: Awaited<ReturnType<typeof storeBuiltCertificateArtifact>>;
  try { artifactStorage = await storeBuiltCertificateArtifact(issue.id, artifact); } catch (error) { return NextResponse.json({ error: `Certificate artifact storage failed: ${error instanceof Error ? error.message : "unavailable"}` }, { status: 503 }); }
  const nextStatus = getCertificateStatusAfterRegeneration(issue.status);
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.certificateIssue.updateMany({
        where: { id: issue.id, status: issue.status },
        data: {
          ...artifactStorage,
          variableValuesJson: variableValues,
          status: nextStatus,
        },
      });
      if (updated.count !== 1) throw new CertificateStatusConflict();
      await tx.coreAuditLog.create({
        data: {
          actorUserId: admin.id,
          action: "certificate.regenerate",
          subjectType: "certificate_issue",
          subjectId: issue.id,
          result: "generated",
          metadataJson: { previousStatus: issue.status, fileName: artifact.fileName, pdfFileName: artifact.pdfFileName, mimeType: artifact.mimeType },
          ...getRequestAuditContext(request),
        },
      });
    });
  } catch (error) {
    if (error instanceof CertificateStatusConflict) {
      return NextResponse.json({ error: "Certificate status changed. Refresh and try again." }, { status: 409 });
    }
    console.error("certificate regenerate failed:", error);
    return NextResponse.json({ error: "Regenerate failed. No state was changed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fileName: artifact.fileName });
}

class CertificateStatusConflict extends Error {}
