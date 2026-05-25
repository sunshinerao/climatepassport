import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import {
  formatCertificateDate,
} from "@/lib/server/certificate-module";
import { getHeaderAuditContext } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { resolvePublicCertificateVerification } from "@/lib/server/certificate-verification";
import { CertificateVerifyPage } from "@/components/certificate-verify-prototype";
import type { VerificationData } from "@/components/certificate-verify-prototype";

export default async function PublicCertificateVerificationPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams?: { preview?: string };
}) {
  noStore();
  const code = params.code.trim();
  const isPreviewCode = code.toUpperCase() === "CV-PREVIEW";
  const isPreviewRequest = isPreviewCode || searchParams?.preview === "1";
  const currentUser = await getCurrentUser();
  const verification = await resolvePublicCertificateVerification({
    code,
    isPreviewRequest,
    channel: "PUBLIC_PAGE",
    querySource: searchParams?.source === "qr" ? "QR_SCAN" : "WEB_QUERY",
    requester: {
      userId: currentUser?.id,
      role: currentUser?.role,
    },
    auditContext: getHeaderAuditContext(headers()),
  });

  const data: VerificationData = {
    status: verification.result === "PREVIEW"
      ? "preview"
      : verification.result === "NOT_FOUND"
        ? "not-found"
        : verification.result === "REVOKED"
          ? "revoked"
          : verification.result === "VALID"
            ? "valid"
            : "invalid",
    certificateName: verification.certificate?.title,
    certificateNameEn: verification.certificate?.titleEn ?? undefined,
    holderName: verification.certificate?.holderName,
    maskedPassportId: verification.certificate?.maskedPassportId ?? undefined,
    issuer: verification.certificate?.issuingOrganization,
    issueDate: verification.certificate?.issuedAt ? formatCertificateDate("en", verification.certificate.issuedAt) : undefined,
    certificateNumber: verification.certificate?.certificateNumber ?? undefined,
    credentialType: verification.certificate?.credentialType,
    credentialTypeEn: verification.certificate?.credentialTypeEn ?? undefined,
    relatedSource: verification.certificate?.extended?.sourceType ?? undefined,
    verifiedAt: formatCertificateDate("en", verification.certificate?.verifiedAt ?? new Date()),
    verificationMessage: verification.message,
    accessLevel: verification.accessLevel,
    isAuthenticatedViewer: verification.certificate?.viewer.isAuthenticated ?? Boolean(currentUser),
    verificationCount: verification.certificate?.extended?.verificationCount,
    queryCount: verification.certificate?.extended?.queryCount,
    holderEmail: verification.certificate?.extended?.holderEmail ?? undefined,
    internalStatus: verification.certificate?.extended?.status,
    verificationMode: verification.certificate?.extended?.verificationMode,
    publicVerifyEnabled: verification.certificate?.extended?.categoryPublicVerifyEnabled,
  };

  return <CertificateVerifyPage locale="en" data={data} />;
}
