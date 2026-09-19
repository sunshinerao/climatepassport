import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { resolveIdentityQrVerification } from "@/lib/server/identity-qr-verification";
import { getIdentityQrExpiry, issueQrToken } from "@/lib/server/qr";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const result = await resolveIdentityQrVerification(token);

  if (!result.ok) {
    return NextResponse.json({ ok: false, status: result.status, error: result.error }, { status: result.httpStatus });
  }

  return NextResponse.json({ ok: true, status: result.status, verification: result.verification }, { status: result.httpStatus });
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "qr-identity-issue"), { limit: 20, windowMs: 60_000, sensitive: true });
  if (rateLimit.unavailable) return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const qr = await issueQrToken({
    type: "IDENTITY",
    userId: user.id,
    subjectType: "user",
    subjectId: user.id,
    expiresAt: getIdentityQrExpiry(),
    metadataJson: {
      climatePassportId: user.climatePassportId,
    },
  });

  return NextResponse.json({
    ok: true,
    qr: {
      token: qr.token,
      type: qr.type,
      expiresAt: qr.expiresAt?.toISOString() ?? null,
    },
  });
}
