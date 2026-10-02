import { NextResponse } from "next/server";
import { ApiErrorSchema, PublicCertificateVerificationResponseSchema } from "@climate-passport/passport-contracts";
import { resolveChannelConfig } from "@climate-passport/passport-core";
import { getRequestAuditContext } from "@/lib/server/audit";
import { resolvePublicCertificateVerification } from "@/lib/server/certificate-verification";
import { authenticateChannelMachine, MACHINE_AUTH_ERROR_CODES, readCallerIp, readMachineCredentials } from "@/lib/server/channel-client-auth";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";
import { getPrismaClient } from "@/lib/server/prisma";

function error(code: "UNAUTHENTICATED" | "SERVICE_UNAVAILABLE" | "RATE_LIMITED" | "CHANNEL_DISABLED" | "CHANNEL_MACHINE_AUTH_FAILED" | "CHANNEL_MACHINE_KEY_EXPIRED" | "CHANNEL_SCOPE_DENIED" | "CHANNEL_ORIGIN_DENIED" | "CHANNEL_IP_DENIED", status: number, headers?: HeadersInit) {
  return NextResponse.json(ApiErrorSchema.parse({ error: { code } }), { status, headers });
}

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "verify-certificate"), { limit: 60, windowMs: 60_000 });
  if (rateLimit.unavailable) return error("SERVICE_UNAVAILABLE", 503);
  if (!rateLimit.allowed) return error("RATE_LIMITED", 429, getRateLimitHeaders(rateLimit));

  const prisma = getPrismaClient();
  const credentials = prisma ? readMachineCredentials(request.headers) : null;

  // CP-TODO-243: registered machine clients authenticate with client key + machine key
  // and bypass the legacy SHCW environment gate; requests without credentials keep the
  // existing user-facing behavior. Presented-but-invalid credentials fail closed.
  if (credentials) {
    if (!prisma) return error("SERVICE_UNAVAILABLE", 503);
    const machineAuth = await authenticateChannelMachine(prisma, {
      clientKey: credentials.clientKey,
      machineKey: credentials.machineKey,
      requiredScope: "channel:certificates:verify",
      origin: request.headers.get("origin"),
      clientIp: readCallerIp(request.headers),
    });
    if (!machineAuth.ok) return error(MACHINE_AUTH_ERROR_CODES[machineAuth.code], machineAuth.status);

    const verification = await resolvePublicCertificateVerification({
      code: params.code,
      channel: "CLIENT_API",
      querySource: "WEB_QUERY",
      auditContext: getRequestAuditContext(request),
    });
    if (verification.httpStatus === 503) return error("SERVICE_UNAVAILABLE", 503);
    const certificate = verification.certificate && verification.accessLevel === "PUBLIC" ? {
      title: verification.certificate.title, holderName: verification.certificate.holderName, maskedPassportId: verification.certificate.maskedPassportId,
      issuingOrganization: verification.certificate.issuingOrganization, issuedAt: verification.certificate.issuedAt, expiryDate: verification.certificate.expiryDate,
      credentialType: verification.certificate.credentialType, certificateNumber: verification.certificate.certificateNumber, verifiedAt: verification.certificate.verifiedAt,
    } : undefined;
    return NextResponse.json(PublicCertificateVerificationResponseSchema.parse({ status: verification.result, valid: verification.valid, verificationCode: verification.verificationCode, message: verification.message, certificate }), { status: verification.httpStatus });
  }

  if (!resolveChannelConfig("SHCW").enabled) return error("CHANNEL_DISABLED", 403);
  const verification = await resolvePublicCertificateVerification({ code: params.code, channel: "SHCW_PUBLIC_API", querySource: "WEB_QUERY", auditContext: getRequestAuditContext(request) });
  if (verification.httpStatus === 503) return error("SERVICE_UNAVAILABLE", 503);
  const certificate = verification.certificate && verification.accessLevel === "PUBLIC" ? {
    title: verification.certificate.title, holderName: verification.certificate.holderName, maskedPassportId: verification.certificate.maskedPassportId,
    issuingOrganization: verification.certificate.issuingOrganization, issuedAt: verification.certificate.issuedAt, expiryDate: verification.certificate.expiryDate,
    credentialType: verification.certificate.credentialType, certificateNumber: verification.certificate.certificateNumber, verifiedAt: verification.certificate.verifiedAt,
  } : undefined;
  return NextResponse.json(PublicCertificateVerificationResponseSchema.parse({ status: verification.result, valid: verification.valid, verificationCode: verification.verificationCode, message: verification.message, certificate }), { status: verification.httpStatus });
}
