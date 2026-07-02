import { NextResponse } from "next/server";
import { z } from "zod";
import { locales, type Locale } from "@/lib/site-content";
import { createUserSession, getDashboardPathForRole, normalizeUserEmail } from "@/lib/server/auth";
import { consumeEmailTokenByCode, consumeEmailTokenByToken } from "@/lib/server/auth-email";
import { sanitizeLocalRedirectPath } from "@/lib/redirect-path";
import { getPrismaClient } from "@/lib/server/prisma";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const confirmSchema = z
  .object({
    locale: z.enum(locales).default("en"),
    next: z.string().optional(),
    email: z.string().trim().email().optional(),
    token: z.string().trim().min(16).optional(),
    code: z.string().trim().regex(/^\d{6}$/).optional(),
  })
  .refine((value) => Boolean(value.token || (value.email && value.code)), {
    message: "Provide token or email + code.",
    path: ["token"],
  });

export async function POST(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = confirmSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid verification payload." },
      { status: 400 },
    );
  }

  const { locale, next, email, token, code } = payload.data;

  const rateLimit = checkRateLimit(getRequestRateLimitKey(request, "auth-verify-confirm"), {
    limit: 10,
    windowMs: 10 * 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const record = token
    ? await consumeEmailTokenByToken({ purpose: "VERIFY_EMAIL", token })
    : await consumeEmailTokenByCode({
        purpose: "VERIFY_EMAIL",
        email: normalizeUserEmail(email ?? ""),
        code: code ?? "",
      });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired verification credential." }, { status: 400 });
  }

  if (email && normalizeUserEmail(email) !== record.email) {
    return NextResponse.json({ error: "Verification credential does not match email." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: record.userId },
    data: {
      emailVerified: new Date(),
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
    },
  });

  await createUserSession(user.id);

  const fallbackPath = getDashboardPathForRole(locale as Locale, user.role);

  return NextResponse.json({
    ok: true,
    redirectTo: sanitizeLocalRedirectPath(next, fallbackPath),
  });
}
