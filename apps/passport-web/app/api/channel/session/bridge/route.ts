import { NextResponse } from "next/server";
import { z } from "zod";
import { issueChannelBridgeToken, requireAuthenticatedUser, sanitizeChannelBridgeTargetPath } from "@/lib/server/auth";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  channel: z.literal("shcw").default("shcw"),
  targetPath: z.string().optional(),
});

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(getRequestRateLimitKey(request, "channel-bridge-issue"), {
    limit: 20,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many bridge token requests." }, { status: 429 });
  }

  const user = await requireAuthenticatedUser("en", "/en/dashboard");
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
