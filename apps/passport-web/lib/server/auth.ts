import { createHash, randomBytes } from "crypto";
import { allocateClimatePassportId, sanitizeChannelBridgeTargetPath as sanitizeCoreChannelBridgeTargetPath } from "@climate-passport/passport-core";
import type { Prisma, UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/site-content";
import { getPrismaClient } from "@/lib/server/prisma";
import { writeCoreAuditLog } from "@/lib/server/audit";

const SESSION_COOKIE_NAME = "climate-passport-session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
// Public dummy bcrypt value, not an account password or secret.
const DUMMY_PASSWORD_HASH = "$2b$10$abcdefghijklmnopqrstuulMFkaJFXXDLWUHAKFRq7fKcs9HB/LdW";
const DEFAULT_CHANNEL_BRIDGE_TARGET_PREFIXES = ["/en", "/zh", "/fr", "/de"];

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: UserRole;
  title: string | null;
  climatePassportId: string | null;
  passCode: string;
  status: string;
  emailVerified: Date | null;
};

type BridgeTokenPayload = {
  token: string;
  channel: "SHCW";
  expiresAt: string;
  targetPath: string | null;
};

function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  };
}

export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashUserPassword(password: string) {
  if (Buffer.byteLength(password, "utf8") > 72) throw new Error("PASSWORD_TOO_LONG");
  const { hash } = await import("bcryptjs");
  return hash(password, 10);
}

export async function verifyUserPassword(storedPassword: string, inputPassword: string) {
  if (Buffer.byteLength(inputPassword, "utf8") > 72) return false;
  const { compare } = await import("bcryptjs");
  const usableHash = BCRYPT_HASH_REGEX.test(storedPassword);
  // Missing/legacy credentials still perform one bcrypt check, but can never authenticate.
  const matches = await compare(inputPassword, usableHash ? storedPassword : DUMMY_PASSWORD_HASH);
  return usableHash && matches;
}

function hashBridgeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getChannelBridgeTargetPrefixes() {
  const configured = process.env.CHANNEL_BRIDGE_TARGET_PATH_PREFIXES?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : DEFAULT_CHANNEL_BRIDGE_TARGET_PREFIXES;
}

export function sanitizeChannelBridgeTargetPath(targetPath: string | null | undefined) {
  return sanitizeCoreChannelBridgeTargetPath(targetPath, getChannelBridgeTargetPrefixes());
}

export async function generateClimatePassportId() {
  const prisma = getPrismaClient();

  if (!prisma) {
    return allocateClimatePassportId(async () => false);
  }

  return allocateClimatePassportId(async (candidate) => {
    const existing = await prisma.user.findUnique({
      where: { climatePassportId: candidate },
      select: { id: true },
    });

    return Boolean(existing);
  });
}

export async function getCurrentSession(): Promise<{
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
  user: AuthenticatedUser;
} | null> {
  const prisma = getPrismaClient();
  const sessionToken = cookies().get(SESSION_COOKIE_NAME)?.value;

  if (!prisma || !sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          title: true,
          climatePassportId: true,
          passCode: true,
          status: true,
          emailVerified: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expires <= new Date()) {
    await prisma.session.delete({ where: { sessionToken } }).catch(() => undefined);
    return null;
  }

  if (session.user.status !== "ACTIVE" || !session.user.emailVerified) {
    await prisma.session.delete({ where: { sessionToken } }).catch(() => undefined);
    return null;
  }

  return session;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export function getDashboardPathForRole(locale: Locale, role: UserRole) {
  if (role === "ADMIN" || role === "EVENT_MANAGER") {
    return `/${locale}/admin/events`;
  }

  return `/${locale}/dashboard/climate-passport`;
}

export function buildLoginPath(locale: Locale, nextPath?: string) {
  if (!nextPath) {
    return `/${locale}/auth/login`;
  }

  return `/${locale}/auth/login?next=${encodeURIComponent(nextPath)}`;
}

export function redirectToLogin(locale: Locale, nextPath?: string): never {
  redirect(buildLoginPath(locale, nextPath));
}

export async function requireAuthenticatedUser(locale: Locale, nextPath?: string): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirectToLogin(locale, nextPath);
  }

  return user;
}

export async function requireRoleAccess(locale: Locale, roles: UserRole[], nextPath?: string): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser(locale, nextPath);

  if (!roles.includes(user.role)) {
    redirect(getDashboardPathForRole(locale, user.role));
  }

  return user;
}

async function sessionForLockedUser(tx: Prisma.TransactionClient, userId: string, expectedPasswordHash?: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true, emailVerified: true, password: true } });
  if (!user || user.status !== "ACTIVE" || !user.emailVerified ||
      (expectedPasswordHash !== undefined && user.password !== expectedPasswordHash)) {
    throw new Error("SESSION_AUTH_CHANGED");
  }
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await tx.session.create({ data: { sessionToken, userId, expires } });
  return { sessionToken, expires };
}

export async function createUserSession(userId: string, expectedPasswordHash?: string) {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Prisma client is unavailable.");
  const session = await prisma.$transaction(async (tx) => {
    // Reset uses the same account lock. A password checked before reset cannot issue a new session after it.
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    return sessionForLockedUser(tx, userId, expectedPasswordHash);
  });
  cookies().set(SESSION_COOKIE_NAME, session.sessionToken, sessionCookieOptions(session.expires));
  return session;
}

export async function destroyCurrentSession() {
  const prisma = getPrismaClient();
  const sessionToken = cookies().get(SESSION_COOKIE_NAME)?.value;

  if (prisma && sessionToken) {
    await prisma.session.delete({ where: { sessionToken } }).catch(() => undefined);
  }

  cookies().delete(SESSION_COOKIE_NAME);
}

export async function issueChannelBridgeToken(options: {
  userId: string;
  targetPath?: string;
  ttlSeconds?: number;
}) {
  const prisma = getPrismaClient();

  if (!prisma) {
    throw new Error("Prisma client is unavailable.");
  }

  const ttlSeconds = options.ttlSeconds ?? 120;
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashBridgeToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const sessionToken = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) throw new Error("SESSION_AUTH_CHANGED");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${options.userId} FOR UPDATE`;
    const source = await tx.session.findUnique({ where: { sessionToken }, include: { user: true } });
    if (!source || source.userId !== options.userId || source.expires <= new Date() ||
        source.user.status !== "ACTIVE" || !source.user.emailVerified) throw new Error("SESSION_AUTH_CHANGED");
    await tx.channelSessionBridge.create({ data: {
      channel: "SHCW", tokenHash, userId: options.userId,
      targetPath: sanitizeChannelBridgeTargetPath(options.targetPath) ?? null, expiresAt,
    } });
  });

  const payload: BridgeTokenPayload = {
    token: rawToken,
    channel: "SHCW",
    expiresAt: expiresAt.toISOString(),
    targetPath: sanitizeChannelBridgeTargetPath(options.targetPath),
  };

  return payload;
}

export async function exchangeChannelBridgeToken(
  token: string,
  auditContext?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Prisma client is unavailable.");
  const tokenHash = hashBridgeToken(token);
  const candidate = await prisma.channelSessionBridge.findUnique({ where: { tokenHash }, select: { id: true, userId: true } });
  if (!candidate) return null;
  let auditResult = "REJECTED";
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${candidate.userId} FOR UPDATE`;
    const bridge = await tx.channelSessionBridge.findUnique({ where: { tokenHash }, include: { user: { select: { id: true, role: true, status: true, emailVerified: true } } } });
    const now = new Date();
    if (bridge?.consumedAt) auditResult = "REPLAY_REJECTED";
    else if (bridge && bridge.expiresAt <= now) auditResult = "EXPIRED_REJECTED";
    if (!bridge || bridge.channel !== "SHCW" || bridge.consumedAt || bridge.expiresAt <= now ||
        bridge.user.status !== "ACTIVE" || !bridge.user.emailVerified) return null;
    const used = await tx.channelSessionBridge.updateMany({
      where: { id: bridge.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now },
    });
    if (used.count !== 1) { auditResult = "REPLAY_REJECTED"; return null; }
    const session = await sessionForLockedUser(tx, bridge.userId);
    return { session, userId: bridge.userId, role: bridge.user.role, targetPath: bridge.targetPath };
  });
  await writeCoreAuditLog({
    actorUserId: result?.userId,
    action: "CHANNEL_BRIDGE_EXCHANGE",
    subjectType: "ChannelSessionBridge",
    subjectId: candidate.id,
    result: result ? "SUCCESS" : auditResult,
    ipAddress: auditContext?.ipAddress,
    userAgent: auditContext?.userAgent,
    metadataJson: { channel: "SHCW" },
  }).catch(() => undefined);
  if (!result) return null;
  cookies().set(SESSION_COOKIE_NAME, result.session.sessionToken, sessionCookieOptions(result.session.expires));
  return { userId: result.userId, role: result.role, targetPath: result.targetPath };
}
