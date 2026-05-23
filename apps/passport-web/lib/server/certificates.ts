import { createCertificateVerificationCode, maskPassportId } from "@climate-passport/passport-core";

export async function allocateCertificateVerificationCode(hasCollision: (candidate: string) => Promise<boolean>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = createCertificateVerificationCode();

    if (!(await hasCollision(candidate))) {
      return candidate;
    }
  }

  throw new Error("Unable to allocate a unique certificate verification code.");
}

export function serializePublicCertificateVerification(issue: {
  id: string;
  status: string;
  verificationCode: string | null;
  issuedAt: Date | null;
  generatedFileName: string | null;
  user: {
    name: string;
    climatePassportId: string | null;
  };
  definition: {
    name: string;
    nameEn: string | null;
    verificationMode: string;
    category: {
      name: string;
      nameEn: string | null;
    };
  };
}) {
  const isIssued = issue.status === "ISSUED";
  const isRevoked = issue.status === "REVOKED";

  return {
    valid: isIssued,
    result: isRevoked ? "REVOKED" : isIssued ? "VALID" : "INVALID",
    certificate: {
      title: issue.definition.name,
      titleEn: issue.definition.nameEn,
      holderName: issue.user.name,
      maskedPassportId: maskPassportId(issue.user.climatePassportId),
      issuingOrganization: "Climate Passport",
      issuedAt: issue.issuedAt?.toISOString() ?? null,
      credentialType: issue.definition.category.name,
      credentialTypeEn: issue.definition.category.nameEn,
      certificateNumber: issue.verificationCode,
      fileName: issue.generatedFileName,
      verifiedAt: new Date().toISOString(),
    },
  };
}
