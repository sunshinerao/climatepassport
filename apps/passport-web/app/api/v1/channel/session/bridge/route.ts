import { NextResponse } from "next/server";
import { ApiErrorSchema, BridgeIssueRequestSchema, BridgeIssueResponseSchema } from "@climate-passport/passport-contracts";
import { resolveChannelConfig, sanitizeChannelBridgeTargetPath } from "@climate-passport/passport-core";
import { getCurrentUser, issueChannelBridgeToken } from "@/lib/server/auth";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";

function error(code: "UNAUTHENTICATED" | "INVALID_REQUEST" | "CHANNEL_DISABLED" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR", status: number, headers?: HeadersInit) {
  return NextResponse.json(ApiErrorSchema.parse({ error: { code } }), { status, headers });
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "channel-bridge-issue"), { limit: 20, windowMs: 60_000, sensitive: true });
  if (rateLimit.unavailable) return error("SERVICE_UNAVAILABLE", 503);
  if (!rateLimit.allowed) return error("RATE_LIMITED", 429, getRateLimitHeaders(rateLimit));
  const config = resolveChannelConfig("SHCW");
  if (!config.enabled) return error("CHANNEL_DISABLED", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return error("INVALID_REQUEST", 400); }
  const payload = BridgeIssueRequestSchema.safeParse(body);
  if (!payload.success) return error("INVALID_REQUEST", 400);
  // CP-TODO-241: this v1 route only serves the registered SHCW channel; other registered
  // clients receive their own endpoints in CP-TODO-243. Unknown channels fail closed.
  if (payload.data.channel !== "SHCW") return error("CHANNEL_DISABLED", 403);
  const targetPath = sanitizeChannelBridgeTargetPath(payload.data.targetPath, config.targetPathPrefixes);
  if (payload.data.targetPath && !targetPath) return error("INVALID_REQUEST", 400);
  const user = await getCurrentUser();
  if (!user) return error("UNAUTHENTICATED", 401);
  try {
    return NextResponse.json(BridgeIssueResponseSchema.parse({ ok: true, bridgeToken: await issueChannelBridgeToken({ userId: user.id, targetPath: targetPath ?? undefined }) }));
  } catch { return error("INTERNAL_ERROR", 500); }
}
