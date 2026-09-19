import { NextResponse } from "next/server";
import { ApiErrorSchema, PublicCertificateVerificationResponseSchema } from "@climate-passport/passport-contracts";
import { resolveChannelConfig } from "@climate-passport/passport-core";
import { getRequestAuditContext } from "@/lib/server/audit";
import { resolvePublicCertificateVerification } from "@/lib/server/certificate-verification";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "verify-certificate"), { limit: 60, windowMs: 60_000 });
  if (rateLimit.unavailable) return NextResponse.json(ApiErrorSchema.parse({ error: { code: "SERVICE_UNAVAILABLE" } }), { status: 503 });
  if (!rateLimit.allowed) return NextResponse.json(ApiErrorSchema.parse({ error: { code: "RATE_LIMITED" } }), { status: 429, headers: getRateLimitHeaders(rateLimit) });
  if (!resolveChannelConfig("SHCW").enabled) return NextResponse.json(ApiErrorSchema.parse({ error: { code: "CHANNEL_DISABLED" } }), { status: 403 });
  const verification = await resolvePublicCertificateVerification({ code: params.code, channel: "SHCW_PUBLIC_API", querySource: "WEB_QUERY", auditContext: getRequestAuditContext(request) });
  if (verification.httpStatus === 503) return NextResponse.json(ApiErrorSchema.parse({ error: { code: "SERVICE_UNAVAILABLE" } }), { status: 503 });
  const certificate = verification.certificate && verification.accessLevel === "PUBLIC" ? {
    title: verification.certificate.title, holderName: verification.certificate.holderName, maskedPassportId: verification.certificate.maskedPassportId,
    issuingOrganization: verification.certificate.issuingOrganization, issuedAt: verification.certificate.issuedAt, expiryDate: verification.certificate.expiryDate,
    credentialType: verification.certificate.credentialType, certificateNumber: verification.certificate.certificateNumber, verifiedAt: verification.certificate.verifiedAt,
  } : undefined;
  return NextResponse.json(PublicCertificateVerificationResponseSchema.parse({ status: verification.result, valid: verification.valid, verificationCode: verification.verificationCode, message: verification.message, certificate }), { status: verification.httpStatus });
}
