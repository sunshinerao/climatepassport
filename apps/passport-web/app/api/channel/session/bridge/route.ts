import { NextResponse } from "next/server";
import { z } from "zod";
import { issueChannelBridgeToken, sanitizeChannelBridgeTargetPath } from "@/lib/server/auth";
import { requireApiUser } from "@/lib/server/api-auth";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  channel: z.literal("shcw").default("shcw"),
  targetPath: z.string().optional(),
});

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "channel-bridge-issue"), {
    limit: 20,
    windowMs: 60_000,
    sensitive: true,
  });
  if (rateLimit.unavailable) return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  }

  const user = await requireApiUser(request);
  if (user instanceof NextResponse) return user;
  const payload = requestSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const bridgeToken = await issueChannelBridgeToken({
    userId: user.id,
    targetPath: sanitizeChannelBridgeTargetPath(payload.data.targetPath) ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    bridgeToken,
  });
}
