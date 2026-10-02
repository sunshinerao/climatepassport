import { checkAuthRateLimit } from "@/lib/server/auth-rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { locales } from "@/lib/site-content";
import { normalizeUserEmail } from "@/lib/server/auth";
import { sanitizeLocalRedirectPath } from "@/lib/redirect-path";
import { enqueueAuthMailRequest } from "@/lib/server/auth-mail-outbox";
import { checkRateLimitAsync, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const registerSchema = z.object({
  locale: z.enum(locales).default("en"),
  next: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes."),
  salutation: z.string().trim().max(20).optional(),
  title: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(1, "Phone number is required.").max(40),
  country: z.string().trim().min(1, "Country / Region is required.").max(80),
  organizationName: z.string().trim().min(1, "Organization name is required.").max(160),
});

export async function POST(request: Request) {
  const payload = registerSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Invalid registration payload." }, { status: 400 });
  const { locale, next, name, email, salutation, title, phone, country, organizationName } = payload.data;
  const normalizedEmail = normalizeUserEmail(email);
  try {
    const durable = await checkAuthRateLimit(normalizedEmail, "auth-email-send", { limit: 6, windowMs: 10 * 60_000 });
    const ip = await checkRateLimitAsync(getRequestRateLimitKey(request, "auth-register"), { limit: 6, windowMs: 10 * 60_000, sensitive: true });
    if (ip.unavailable) throw new Error("RATE_LIMIT_UNAVAILABLE");
    if (!durable.allowed || !ip.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  } catch {
    console.error("[auth/register] RATE_LIMIT_UNAVAILABLE");
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  // Persist the same account-independent request for every valid email. Account
  // eligibility, expensive work and delivery run only in the outbox processor.
  try {
    await enqueueAuthMailRequest({
      kind: "REGISTER", email: normalizedEmail, locale: locale === "zh" ? "zh" : "en",
      profile: { name, phone, country, organizationName, salutation, title },
    });
  } catch {
    console.error("[auth/register] ENQUEUE_UNAVAILABLE");
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
  const safeNext = sanitizeLocalRedirectPath(next, `/${locale}/dashboard/climate-passport`);
  const params = new URLSearchParams({ email: normalizedEmail, next: safeNext });
  return NextResponse.json({ ok: true, message: "If eligible, instructions will be sent to this email.", redirectTo: `/${locale}/auth/verify-email?${params.toString()}` });
}
