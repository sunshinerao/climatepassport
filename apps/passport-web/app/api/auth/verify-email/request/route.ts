import { NextResponse } from "next/server";
import { z } from "zod";
import { locales, type Locale } from "@/lib/site-content";
import { normalizeUserEmail } from "@/lib/server/auth";
import { createEmailToken, sendVerificationEmail } from "@/lib/server/auth-email";
import { getPrismaClient } from "@/lib/server/prisma";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  locale: z.enum(locales).default("en"),
  email: z.string().trim().email(),
});

export async function POST(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = requestSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid verification request payload." },
      { status: 400 },
    );
  }

  const { locale, email } = payload.data;
  const normalizedEmail = normalizeUserEmail(email);

  const rateLimit = checkRateLimit(`${getRequestRateLimitKey(request, "auth-verify-request")}:${normalizedEmail}`, {
    limit: 6,
    windowMs: 10 * 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      status: true,
      emailVerified: true,
    },
  });

  if (user && user.status === "ACTIVE" && !user.emailVerified) {
    const token = await createEmailToken({
      userId: user.id,
      email: user.email,
      purpose: "VERIFY_EMAIL",
    });

    try {
      const origin = new URL(request.url).origin;
      await sendVerificationEmail({
        locale: locale as Locale,
        email: user.email,
        token: token.token,
        code: token.code,
        origin,
      });
    } catch (error) {
      console.error("[auth/verify-email/request] failed to send verification email", error);
      return NextResponse.json({ error: "Unable to send verification email right now." }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}
