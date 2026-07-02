import { createHash, randomBytes, randomInt } from "crypto";
import type { AuthEmailTokenPurpose } from "@prisma/client";
import type { Locale } from "@/lib/site-content";
import { sendTransactionalMail } from "@/lib/server/mailer";
import { getPrismaClient } from "@/lib/server/prisma";

const VERIFY_EMAIL_TTL_MINUTES = 30;
const RESET_PASSWORD_TTL_MINUTES = 30;

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken() {
  return randomBytes(32).toString("hex");
}

function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function normalizeOrigin(origin: string) {
  return origin.replace(/\/$/, "");
}

function resolveLinkLocale(locale: Locale) {
  return locale === "zh" ? "zh" : "en";
}

export async function createEmailToken(options: {
  userId: string;
  email: string;
  purpose: AuthEmailTokenPurpose;
  ttlMinutes?: number;
}) {
  const prisma = getPrismaClient();

  if (!prisma) {
    throw new Error("Database unavailable.");
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const code = generateCode();
  const ttlMinutes = options.ttlMinutes ?? (options.purpose === "VERIFY_EMAIL" ? VERIFY_EMAIL_TTL_MINUTES : RESET_PASSWORD_TTL_MINUTES);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  await prisma.authEmailToken.create({
    data: {
      userId: options.userId,
      email: options.email,
      purpose: options.purpose,
      tokenHash,
      code,
      expiresAt,
    },
  });

  return { token: rawToken, code, expiresAt };
}

export async function consumeEmailTokenByToken(options: {
  purpose: AuthEmailTokenPurpose;
  token: string;
}) {
  const prisma = getPrismaClient();

  if (!prisma) {
    throw new Error("Database unavailable.");
  }

  const tokenHash = hashToken(options.token);
  const record = await prisma.authEmailToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!record) return null;
  if (record.purpose !== options.purpose) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt <= new Date()) return null;

  await prisma.authEmailToken.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return record;
}

export async function consumeEmailTokenByCode(options: {
  purpose: AuthEmailTokenPurpose;
  email: string;
  code: string;
}) {
  const prisma = getPrismaClient();

  if (!prisma) {
    throw new Error("Database unavailable.");
  }

  const record = await prisma.authEmailToken.findFirst({
    where: {
      purpose: options.purpose,
      email: options.email,
      code: options.code,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!record) return null;

  await prisma.authEmailToken.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return record;
}

export async function sendVerificationEmail(options: {
  locale: Locale;
  email: string;
  token: string;
  code: string;
  origin: string;
}) {
  const locale = resolveLinkLocale(options.locale);
  const origin = normalizeOrigin(options.origin);
  const link = `${origin}/${locale}/auth/verify-email?token=${encodeURIComponent(options.token)}&email=${encodeURIComponent(options.email)}`;

  await sendTransactionalMail({
    to: options.email,
    subject: "Verify your Climate Passport email",
    text: `Your verification code is ${options.code}.\n\nOr use this secure link:\n${link}\n\nThis code expires in ${VERIFY_EMAIL_TTL_MINUTES} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin-bottom: 12px;">Verify your email</h2>
        <p>Your Climate Passport verification code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 12px 0;">${options.code}</p>
        <p>This code expires in ${VERIFY_EMAIL_TTL_MINUTES} minutes.</p>
        <p style="margin-top: 16px;">Or click this secure link:</p>
        <p><a href="${link}">${link}</a></p>
      </div>
    `,
  });
}

export async function sendResetPasswordEmail(options: {
  locale: Locale;
  email: string;
  token: string;
  code: string;
  origin: string;
}) {
  const locale = resolveLinkLocale(options.locale);
  const origin = normalizeOrigin(options.origin);
  const link = `${origin}/${locale}/auth/reset-password?token=${encodeURIComponent(options.token)}&email=${encodeURIComponent(options.email)}`;

  await sendTransactionalMail({
    to: options.email,
    subject: "Reset your Climate Passport password",
    text: `Your password reset code is ${options.code}.\n\nOr use this secure link:\n${link}\n\nThis code expires in ${RESET_PASSWORD_TTL_MINUTES} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin-bottom: 12px;">Reset your password</h2>
        <p>Your Climate Passport reset code is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 12px 0;">${options.code}</p>
        <p>This code expires in ${RESET_PASSWORD_TTL_MINUTES} minutes.</p>
        <p style="margin-top: 16px;">Or click this secure link:</p>
        <p><a href="${link}">${link}</a></p>
      </div>
    `,
  });
}
