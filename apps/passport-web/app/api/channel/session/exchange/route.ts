import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeChannelBridgeToken, getDashboardPathForRole } from "@/lib/server/auth";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";
import { locales } from "@/lib/site-content";
import { getRequestAuditContext } from "@/lib/server/audit";

const exchangeSchema = z.object({
  token: z.string().min(1),
  locale: z.enum(locales).default("en"),
});

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "channel-bridge-exchange"), {
    limit: 30,
    windowMs: 60_000,
    sensitive: true,
  });
  if (rateLimit.unavailable) return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  }

  const payload = exchangeSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const exchanged = await exchangeChannelBridgeToken(payload.data.token, getRequestAuditContext(request));

  if (!exchanged) {
    return NextResponse.json({ error: "Invalid or expired bridge token." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    redirectTo:
      exchanged.targetPath || getDashboardPathForRole(payload.data.locale, exchanged.role),
  });
}
