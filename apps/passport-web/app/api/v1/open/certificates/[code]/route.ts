import { PublicCertificateVerificationResponseSchema } from "@climate-passport/passport-contracts";
import { getRequestAuditContext } from "@/lib/server/audit";
import { resolvePublicCertificateVerification } from "@/lib/server/certificate-verification";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiError, openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";

export const OPTIONS = openApiOptions;

/**
 * Open API 证书验真：与 `/api/v1/channel/certificates/verify/[code]` 走同一个最小披露
 * 投影，但**没有匿名退回分支**——没有有效 API Key 就拿不到任何证书字段。
 */
export async function GET(request: Request, { params }: { params: { code: string } }) {
  const gate = await requireOpenApiKey(request, { scope: "channel:certificates:verify" });
  if (!gate.ok) return gate.response;

  const verification = await resolvePublicCertificateVerification({
    code: params.code,
    channel: "CLIENT_API",
    querySource: "WEB_QUERY",
    auditContext: getRequestAuditContext(request),
  });
  if (verification.httpStatus === 503) {
    return openApiError({ code: "SERVICE_UNAVAILABLE", status: 503, requestId: gate.requestId });
  }

  const certificate = verification.certificate && verification.accessLevel === "PUBLIC"
    ? {
        title: verification.certificate.title,
        holderName: verification.certificate.holderName,
        maskedPassportId: verification.certificate.maskedPassportId,
        issuingOrganization: verification.certificate.issuingOrganization,
        issuedAt: verification.certificate.issuedAt,
        expiryDate: verification.certificate.expiryDate,
        credentialType: verification.certificate.credentialType,
        certificateNumber: verification.certificate.certificateNumber,
        verifiedAt: verification.certificate.verifiedAt,
      }
    : undefined;

  return openApiOk(
    gate,
    PublicCertificateVerificationResponseSchema.parse({
      status: verification.result,
      valid: verification.valid,
      verificationCode: verification.verificationCode,
      message: verification.message,
      certificate,
    }),
    verification.httpStatus,
  );
}
