import { randomBytes, randomInt } from "crypto";
import type { AuthEmailTokenPurpose } from "@prisma/client";
import type { Locale } from "@/lib/site-content";
import { sendTransactionalMail } from "@/lib/server/mailer";
import { getPrismaClient } from "@/lib/server/prisma";
import { getAuthPublicOrigin, hashEmailToken, hashEmailCode, matchesEmailCode, MAX_EMAIL_CODE_ATTEMPTS, getAuthCredentialVersion } from "@/lib/server/auth-email-security";

const VERIFY_EMAIL_TTL_MINUTES = 30;
const RESET_PASSWORD_TTL_MINUTES = 30;
const normalizeEmail = (email: string) => email.trim().toLowerCase();
function resolveLinkLocale(locale: Locale) { return locale === "zh" ? "zh" : "en"; }

// A PostgreSQL serialization conflict aborts the whole transaction. Retry from a
// fresh snapshot; never retry non-serialization failures or commit partial work.
async function serializable<T>(work: (tx: import("@prisma/client").Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable.");
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: "Serializable" }); }
    catch (error) {
      if (attempt >= 2 || (error as { code?: string }).code !== "P2034") throw error;
    }
  }
}

export async function createEmailToken(options: {
  userId: string; email: string; purpose: AuthEmailTokenPurpose; ttlMinutes?: number;
}) {
  // Configuration failures must happen before creating a credential.
  getAuthPublicOrigin();
  const credentialVersion = getAuthCredentialVersion();
  const email = normalizeEmail(options.email);
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashEmailToken(token);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = hashEmailCode(code, { ...options, email, tokenHash, credentialVersion });
  const ttl = options.ttlMinutes ?? 30;
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 30) throw new Error("Invalid email token lifetime.");
  return serializable(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${options.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: options.userId } });
    if (!user || user.email !== email || user.status !== "ACTIVE" ||
        (options.purpose === "VERIFY_EMAIL" ? user.emailVerified !== null : user.emailVerified === null)) throw new Error("Account is not eligible for this email action.");
    const now = new Date();
    // New mail cannot reset the persisted guessing budget while prior challenges
    // are still valid. Issuance and completion serialize on the same user row.
    const previous = await tx.authEmailToken.findFirst({
      where: { userId: user.id, purpose: options.purpose, credentialVersion, expiresAt: { gt: now } },
      orderBy: { attempts: "desc" },
    });
    const attempts = previous?.attempts ?? 0;
    if (attempts >= MAX_EMAIL_CODE_ATTEMPTS) throw new Error("Email credential attempt limit reached.");
    await tx.authEmailToken.updateMany({ where: { userId: user.id, purpose: options.purpose, consumedAt: null }, data: { consumedAt: now } });
    const expiresAt = new Date(now.getTime() + ttl * 60_000);
    const credential = await tx.authEmailToken.create({ data: { userId: user.id, email, purpose: options.purpose, tokenHash, codeHash, expiresAt, attempts, credentialVersion } });
    return { token, code, expiresAt, credentialId: credential.id };
  });
}

/** Complete CP self-account actions atomically. PENDING partner claims are not supported. */
export async function completeAuthEmailAction(options: {
  purpose: AuthEmailTokenPurpose; email?: string; token?: string; code?: string; passwordHash?: string;
}) {
  if (!['VERIFY_EMAIL', 'RESET_PASSWORD'].includes(options.purpose)) return null;
  if (Boolean(options.token) === Boolean(options.code)) return null;
  if (options.token && !/^[a-f0-9]{64}$/.test(options.token)) return null;
  if (options.code && (!/^\d{6}$/.test(options.code) || !options.email)) return null;
  if (!options.passwordHash) return null;
  const credentialVersion = getAuthCredentialVersion();
  const email = options.email === undefined ? undefined : normalizeEmail(options.email);
  return serializable(async tx => {
    const record = options.token
      ? await tx.authEmailToken.findUnique({ where: { tokenHash: hashEmailToken(options.token) } })
      : await tx.authEmailToken.findFirst({ where: { email, purpose: options.purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
    if (!record || record.credentialVersion !== credentialVersion || record.purpose !== options.purpose || record.consumedAt || record.expiresAt <= new Date() || record.attempts >= MAX_EMAIL_CODE_ATTEMPTS || (email !== undefined && record.email !== email)) return null;
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${record.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: record.userId } });
    if (!user || user.email !== record.email || user.status !== "ACTIVE" ||
        (options.purpose === "VERIFY_EMAIL" ? user.emailVerified !== null : user.emailVerified === null)) return null;
    const now = new Date();
    if (record.expiresAt <= now) return null;
    if (options.code && !matchesEmailCode(record.codeHash, hashEmailCode(options.code, record))) {
      // Returning null commits the increment. Throwing here would roll it back.
      await tx.authEmailToken.updateMany({ where: { id: record.id, consumedAt: null, attempts: { lt: MAX_EMAIL_CODE_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
      return null;
    }
    const consumed = await tx.authEmailToken.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: MAX_EMAIL_CODE_ATTEMPTS } }, data: { consumedAt: now } });
    if (consumed.count !== 1) return null;
    const updated = await tx.user.updateMany({
      where: { id: user.id, email: record.email, status: "ACTIVE", emailVerified: options.purpose === "VERIFY_EMAIL" ? null : { not: null } },
      data: options.purpose === "VERIFY_EMAIL"
        ? { emailVerified: now, password: options.passwordHash, resetToken: null, resetTokenExpiry: null }
        : { password: options.passwordHash, resetToken: null, resetTokenExpiry: null },
    });
    if (updated.count !== 1) throw new Error("Account changed during email action.");
    // The mailbox holder sets a fresh password during verification too: never
    // activate a password chosen by an unverified preregistration requester.
    // Revoke every old credential/session in the same transaction for either action.
    await tx.authEmailToken.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.channelSessionBridge.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
    return { userId: user.id, email: user.email, role: user.role };
  });
}

export async function sendVerificationEmail(options: {
  locale: Locale;
  email: string;
  token: string;
  code: string;
  origin?: string;
}) {
  const locale = resolveLinkLocale(options.locale);
  const origin = getAuthPublicOrigin();
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
  origin?: string;
}) {
  const locale = resolveLinkLocale(options.locale);
  const origin = getAuthPublicOrigin();
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
