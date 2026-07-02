import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeUserEmail, hashUserPassword } from "@/lib/server/auth";
import { consumeEmailTokenByCode, consumeEmailTokenByToken } from "@/lib/server/auth-email";
import { getPrismaClient } from "@/lib/server/prisma";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const resetPasswordSchema = z
  .object({
    email: z.string().trim().email(),
    token: z.string().trim().min(16).optional(),
    code: z.string().trim().regex(/^\d{6}$/).optional(),
    password: z.string().min(8).max(72),
  })
  .refine((value) => Boolean(value.token || value.code), {
    message: "Provide token or code.",
    path: ["token"],
  });

export async function POST(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = resetPasswordSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid reset password payload." },
      { status: 400 },
    );
  }

  const { email, token, code, password } = payload.data;
  const normalizedEmail = normalizeUserEmail(email);

  const rateLimit = checkRateLimit(`${getRequestRateLimitKey(request, "auth-reset-password")}:${normalizedEmail}`, {
    limit: 10,
    windowMs: 10 * 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const record = token
    ? await consumeEmailTokenByToken({ purpose: "RESET_PASSWORD", token })
    : await consumeEmailTokenByCode({
        purpose: "RESET_PASSWORD",
        email: normalizedEmail,
        code: code ?? "",
      });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired reset credential." }, { status: 400 });
  }

  if (record.email !== normalizedEmail) {
    return NextResponse.json({ error: "Reset credential does not match email." }, { status: 400 });
  }

  if (record.user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is not active." }, { status: 403 });
  }

  const passwordHash = await hashUserPassword(password);

  await prisma.user.update({
    where: { id: record.userId },
    data: {
      password: passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return NextResponse.json({ ok: true });
}
