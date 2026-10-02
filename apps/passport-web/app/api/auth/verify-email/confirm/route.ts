import { checkAuthRateLimit } from "@/lib/server/auth-rate-limit";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { locales } from "@/lib/site-content";
import { normalizeUserEmail, hashUserPassword } from "@/lib/server/auth";
import { completeAuthEmailAction } from "@/lib/server/auth-email";
import { sanitizeLocalRedirectPath } from "@/lib/redirect-path";
import { checkRateLimitAsync, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const confirmSchema = z
  .object({
    locale: z.enum(locales).default("en"),
    next: z.string().optional(),
    password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes."),
    email: z.string().trim().email().optional(),
    token: z.string().trim().min(16).optional(),
    code: z.string().trim().regex(/^\d{6}$/).optional(),
  })
  .refine((value) => Boolean(value.token) !== Boolean(value.code) && Boolean(value.token || value.email), {
    message: "Provide exactly one token or email + code.",
    path: ["token"],
  });

export async function POST(request: Request) {
  const payload = confirmSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
  const { locale, next, email, token, code, password } = payload.data;
  const normalizedEmail = email ? normalizeUserEmail(email) : undefined;
  // Token-only links are high entropy; code guesses always use an account quota.
  const principal = normalizedEmail ?? `token:${createHash("sha256").update(token ?? "").digest("hex")}`;
  try {
    const durable = await checkAuthRateLimit(principal, "auth-verify-confirm", { limit: 10, windowMs: 10 * 60_000 });
    const ip = await checkRateLimitAsync(getRequestRateLimitKey(request, "auth-verify-confirm"), { limit: 10, windowMs: 10 * 60_000, sensitive: true });
    if (ip.unavailable) throw new Error("RATE_LIMIT_UNAVAILABLE");
    if (!durable.allowed || !ip.allowed) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    const passwordHash = await hashUserPassword(password);
    const result = await completeAuthEmailAction({ purpose: "VERIFY_EMAIL", email: normalizedEmail, token, code, passwordHash });
    if (!result) return NextResponse.json({ error: "Invalid or expired verification credential." }, { status: 400 });
    // Verification proves email ownership only. Login performs a fresh status and
    // password check; no session is issued outside the atomic verification guard.
    const safeNext = sanitizeLocalRedirectPath(next, `/${locale}/dashboard/climate-passport`);
    return NextResponse.json({ ok: true, redirectTo: `/${locale}/auth/login?${new URLSearchParams({ next: safeNext }).toString()}` });
  } catch {
    console.error("[auth/verify-email/confirm] VERIFICATION_UNAVAILABLE");
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
}
