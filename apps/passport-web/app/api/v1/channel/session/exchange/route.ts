import { NextResponse } from "next/server";
import { ApiErrorSchema, BridgeExchangeRequestSchema, BridgeExchangeResponseSchema } from "@climate-passport/passport-contracts";
import { resolveChannelConfig } from "@climate-passport/passport-core";
import { exchangeChannelBridgeToken, getDashboardPathForRole } from "@/lib/server/auth";
import { getRequestAuditContext } from "@/lib/server/audit";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";

function error(code: "INVALID_REQUEST" | "INVALID_BRIDGE_TOKEN" | "CHANNEL_DISABLED" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR", status: number, headers?: HeadersInit) {
  return NextResponse.json(ApiErrorSchema.parse({ error: { code } }), { status, headers });
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "channel-bridge-exchange"), { limit: 30, windowMs: 60_000, sensitive: true });
  if (rateLimit.unavailable) return error("SERVICE_UNAVAILABLE", 503);
  if (!rateLimit.allowed) return error("RATE_LIMITED", 429, getRateLimitHeaders(rateLimit));
  if (!resolveChannelConfig("SHCW").enabled) return error("CHANNEL_DISABLED", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return error("INVALID_REQUEST", 400); }
  const payload = BridgeExchangeRequestSchema.safeParse(body);
  if (!payload.success) return error("INVALID_REQUEST", 400);
  // CP-TODO-241: the v1 bridge only serves the registered SHCW channel; fail closed otherwise.
  if (payload.data.channel !== "SHCW") return error("CHANNEL_DISABLED", 403);
  try {
    const exchanged = await exchangeChannelBridgeToken(payload.data.token, getRequestAuditContext(request));
    if (!exchanged) return error("INVALID_BRIDGE_TOKEN", 401);
    return NextResponse.json(BridgeExchangeResponseSchema.parse({ ok: true, redirectTo: exchanged.targetPath || getDashboardPathForRole(payload.data.locale, exchanged.role) }));
  } catch { return error("INTERNAL_ERROR", 500); }
}
