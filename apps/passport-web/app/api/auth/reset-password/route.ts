import { checkAuthRateLimit } from "@/lib/server/auth-rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeUserEmail, hashUserPassword } from "@/lib/server/auth";
import { completeAuthEmailAction } from "@/lib/server/auth-email";
import { checkRateLimitAsync, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const resetPasswordSchema = z
  .object({
    email: z.string().trim().email(),
    token: z.string().trim().min(16).optional(),
    code: z.string().trim().regex(/^\d{6}$/).optional(),
    password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes."),
  })
  .refine((value) => Boolean(value.token) !== Boolean(value.code), {
    message: "Provide exactly one token or code.",
    path: ["token"],
  });

export async function POST(request: Request) {
  const payload = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Invalid reset password payload." }, { status: 400 });
  const { email, token, code, password } = payload.data;
  const normalizedEmail = normalizeUserEmail(email);
  try {
    const durable = await checkAuthRateLimit(normalizedEmail, "auth-reset-confirm", { limit: 10, windowMs: 10 * 60_000 });
    const ip = await checkRateLimitAsync(getRequestRateLimitKey(request, "auth-reset-password"), { limit: 10, windowMs: 10 * 60_000, sensitive: true });
    if (ip.unavailable) throw new Error("RATE_LIMIT_UNAVAILABLE");
    if (!durable.allowed || !ip.allowed) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    const passwordHash = await hashUserPassword(password);
    const result = await completeAuthEmailAction({ purpose: "RESET_PASSWORD", email: normalizedEmail, token, code, passwordHash });
    if (!result) return NextResponse.json({ error: "Invalid or expired reset credential." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[auth/reset-password] RESET_UNAVAILABLE");
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
}
