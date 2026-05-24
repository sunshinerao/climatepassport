import { unstable_noStore as noStore } from "next/cache";
import {
  formatCertificateDate,
  getCertificateName,
  getCertificateIssueForPublicVerification,
  serializePublicHolder,
} from "@/lib/server/certificate-module";
import { CertificateVerifyPage } from "@/components/certificate-verify-prototype";
import type { VerificationData } from "@/components/certificate-verify-prototype";

export default async function PublicCertificateVerificationPage({ params }: { params: { code: string } }) {
  noStore();
  const issue = await getCertificateIssueForPublicVerification(params.code.trim());
  const verifiedAt = new Date();

  if (!issue) {
    const data: VerificationData = {
      status: "not-found",
      verifiedAt: formatCertificateDate("en", verifiedAt),
    };
    return <CertificateVerifyPage locale="en" data={data} />;
  }

  const holder = serializePublicHolder(issue.user);
  const isRevoked = issue.status === "REVOKED";
  const isIssued = issue.status === "ISSUED";

  const data: VerificationData = {
    status: isRevoked ? "revoked" : isIssued ? "valid" : "expired",
    certificateName: getCertificateName("en", issue.definition),
    holderName: holder.name,
    maskedPassportId: holder.maskedPassportId || undefined,
    issuer: "Climate Passport",
    issueDate: formatCertificateDate("en", issue.issuedAt ?? issue.createdAt),
    certificateNumber: issue.verificationCode ?? undefined,
    credentialType: getCertificateName("en", issue.definition.category),
    relatedSource: issue.sourceType ?? "Climate Passport record",
    verifiedAt: formatCertificateDate("en", verifiedAt),
  };

  return <CertificateVerifyPage locale="en" data={data} />;
}
