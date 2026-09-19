import { NextResponse } from "next/server";
import { getRequestAuditContext } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { resolvePublicCertificateVerification } from "@/lib/server/certificate-verification";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "verify-certificate"), { limit: 60, windowMs: 60_000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  const code = params.code;
  const isPreviewRequest = code.toUpperCase() === "CV-PREVIEW"
    || new URL(request.url).searchParams.get("preview") === "1";
  const currentUser = await getCurrentUser();
  const querySource = new URL(request.url).searchParams.get("source") === "qr" ? "QR_SCAN" : "WEB_QUERY";
  const verification = await resolvePublicCertificateVerification({
    code,
    isPreviewRequest,
    channel: "PUBLIC_API",
    querySource,
    requester: {
      userId: currentUser?.id,
      role: currentUser?.role,
    },
    auditContext: getRequestAuditContext(request),
  });

  return NextResponse.json(verification, { status: verification.httpStatus });
}
