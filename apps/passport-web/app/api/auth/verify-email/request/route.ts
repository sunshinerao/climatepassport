import { checkAuthRateLimit } from "@/lib/server/auth-rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { locales } from "@/lib/site-content";
import { normalizeUserEmail } from "@/lib/server/auth";
import { enqueueAuthMailRequest } from "@/lib/server/auth-mail-outbox";
import { checkRateLimitAsync, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const schema = z.object({ locale: z.enum(locales).default("en"), email: z.string().trim().email() });
export async function POST(request: Request) {
  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  const { locale, email } = payload.data;
  const normalizedEmail = normalizeUserEmail(email);
  try {
    const durable = await checkAuthRateLimit(normalizedEmail, "auth-email-send", { limit: 6, windowMs: 10 * 60_000 });
    const ip = await checkRateLimitAsync(getRequestRateLimitKey(request, "auth-verify-email/request"), { limit: 6, windowMs: 10 * 60_000, sensitive: true });
    if (ip.unavailable) throw new Error("RATE_LIMIT_UNAVAILABLE");
    if (!durable.allowed || !ip.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  } catch {
    console.error("[auth/verify-email/request] RATE_LIMIT_UNAVAILABLE");
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
  // Persist the same account-independent request for every valid email. Account
  // eligibility, expensive work and delivery run only in the outbox processor.
  try {
    await enqueueAuthMailRequest({
      kind: "VERIFY", email: normalizedEmail, locale: locale === "zh" ? "zh" : "en",
    });
  } catch {
    console.error("[auth/verify-email/request] ENQUEUE_UNAVAILABLE");
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, message: "If eligible, instructions will be sent to this email." });
}
