import { checkAuthRateLimit } from "@/lib/server/auth-rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { locales, type Locale } from "@/lib/site-content";
import {
  createUserSession,
  getDashboardPathForRole,
  normalizeUserEmail,
  verifyUserPassword,
} from "@/lib/server/auth";
import { sanitizeLocalRedirectPath } from "@/lib/redirect-path";
import { getPrismaClient } from "@/lib/server/prisma";
import { checkRateLimitAsync, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const loginSchema = z.object({
  locale: z.enum(locales).default("en"),
  next: z.string().optional(),
  email: z.string().trim().email(),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes."),
});

export async function POST(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = loginSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid login payload." },
      { status: 400 },
    );
  }

  const { locale, next, email, password } = payload.data;
  const normalizedEmail = normalizeUserEmail(email);

  try {
    const durable = await checkAuthRateLimit(normalizedEmail, "auth-login", { limit: 8, windowMs: 5 * 60_000 });
    const ip = await checkRateLimitAsync(getRequestRateLimitKey(request, "auth-login"), { limit: 8, windowMs: 5 * 60_000, sensitive: true });
    if (ip.unavailable) throw new Error("RATE_LIMIT_UNAVAILABLE");
    if (!durable.allowed || !ip.allowed) return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
  } catch {
    console.error("[auth/login] RATE_LIMIT_UNAVAILABLE");
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      password: true,
      role: true,
      status: true,
    },
  });

  const passwordMatches = await verifyUserPassword(user?.password ?? "", password);

  if (!user || user.status !== "ACTIVE" || !passwordMatches) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!user.emailVerified) {
    const fallbackPath = getDashboardPathForRole(locale as Locale, user.role);
    const safeNext = sanitizeLocalRedirectPath(next, fallbackPath);
    const verifyParams = new URLSearchParams({
      email: user.email,
      next: safeNext,
    });

    return NextResponse.json(
      {
        error: "Please verify your email before logging in.",
        requiresVerification: true,
        redirectTo: `/${locale}/auth/verify-email?${verifyParams.toString()}`,
      },
      { status: 403 },
    );
  }

  try {
    await createUserSession(user.id, user.password);
  } catch {
    // Status/password may have changed after the initial credential check.
    console.error("[auth/login] SESSION_CREATION_REJECTED");
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const fallbackPath = getDashboardPathForRole(locale as Locale, user.role);

  return NextResponse.json({
    ok: true,
    redirectTo: sanitizeLocalRedirectPath(next, fallbackPath),
  });
}
