import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext } from "@/lib/server/audit";
import { issueInvitationSpecialPassQr } from "@/lib/server/invitation-special-pass-qr";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "special-pass-qr-issue"), { limit: 20, windowMs: 60_000, sensitive: true });
  if (rateLimit.unavailable) return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!["ADMIN", "EVENT_MANAGER"].includes(actor.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  try {
    const result = await issueInvitationSpecialPassQr({
      actor,
      subjectType: "special_pass",
      subjectId: params.id,
      auditContext: getRequestAuditContext(request),
    });

    return NextResponse.json({
      ok: true,
      qr: {
        token: result.token,
        type: "INVITATION_SPECIAL_PASS",
        kind: "special_pass",
        expiresAt: result.expiresAt.toISOString(),
      },
      revokedPreviousTokenCount: result.revokedPreviousTokenIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to issue QR.";
    const status = message.includes("not found")
      ? 404
      : message.includes("permissions")
      ? 403
      : message.includes("not approved") || message.includes("not bound")
      ? 409
      : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
