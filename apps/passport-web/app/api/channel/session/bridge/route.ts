import { NextResponse } from "next/server";
import { z } from "zod";
import { issueChannelBridgeToken, requireAuthenticatedUser } from "@/lib/server/auth";

const requestSchema = z.object({
  channel: z.literal("shcw").default("shcw"),
  targetPath: z.string().optional(),
});

export async function POST(request: Request) {
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
    targetPath: payload.data.targetPath,
  });

  return NextResponse.json({
    ok: true,
    bridgeToken,
  });
}
