import { createHash, randomBytes } from "crypto";
import { allocateClimatePassportId, sanitizeChannelBridgeTargetPath as sanitizeCoreChannelBridgeTargetPath } from "@climate-passport/passport-core";
import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/site-content";
import { getPrismaClient } from "@/lib/server/prisma";
import { writeCoreAuditLog } from "@/lib/server/audit";

const SESSION_COOKIE_NAME = "climate-passport-session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
// Full bcrypt verifier only: $2a$/$2b$/$2y$, two-digit cost, 22-char salt, 31-char hash.
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
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
  const { hash } = await import("bcryptjs");
  return hash(password, 10);
}

export async function verifyUserPassword(storedPassword: string, inputPassword: string) {
  const { compare } = await import("bcryptjs");

  if (!BCRYPT_HASH_REGEX.test(storedPassword)) {
    return false;
  }

  try {
    return await compare(inputPassword, storedPassword);
  } catch {
    return false;
  }
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

  if (session.user.status !== "ACTIVE") {
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

export async function createUserSession(userId: string) {
  const prisma = getPrismaClient();

  if (!prisma) {
    throw new Error("Prisma client is unavailable.");
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires,
    },
  });

  cookies().set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions(expires));

  return { sessionToken, expires };
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

  await prisma.channelSessionBridge.create({
    data: {
      channel: "SHCW",
      tokenHash,
      userId: options.userId,
      targetPath: sanitizeChannelBridgeTargetPath(options.targetPath) ?? null,
      expiresAt,
    },
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

  if (!prisma) {
    throw new Error("Prisma client is unavailable.");
  }

  const tokenHash = hashBridgeToken(token);
  const bridge = await prisma.channelSessionBridge.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!bridge || bridge.channel !== "SHCW") {
    return null;
  }

  if (bridge.user.status !== "ACTIVE") {
    return null;
  }

  if (bridge.consumedAt || bridge.expiresAt <= new Date()) {
    await writeCoreAuditLog({
      action: "CHANNEL_BRIDGE_EXCHANGE",
      subjectType: "ChannelSessionBridge",
      subjectId: bridge.id,
      result: bridge.consumedAt ? "REPLAY_REJECTED" : "EXPIRED_REJECTED",
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
      metadataJson: { channel: bridge.channel },
    }).catch(() => undefined);
    return null;
  }

  // Claim the one-time token at the database layer so concurrent exchanges cannot both create sessions.
  const consumed = await prisma.channelSessionBridge.updateMany({
    where: {
      id: bridge.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });

  if (consumed.count !== 1) {
    await writeCoreAuditLog({
      action: "CHANNEL_BRIDGE_EXCHANGE",
      subjectType: "ChannelSessionBridge",
      subjectId: bridge.id,
      result: "REPLAY_REJECTED",
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
      metadataJson: { channel: bridge.channel },
    }).catch(() => undefined);
    return null;
  }

  await createUserSession(bridge.userId);

  await writeCoreAuditLog({
    actorUserId: bridge.userId,
    action: "CHANNEL_BRIDGE_EXCHANGE",
    subjectType: "ChannelSessionBridge",
    subjectId: bridge.id,
    result: "SUCCESS",
    ipAddress: auditContext?.ipAddress,
    userAgent: auditContext?.userAgent,
    metadataJson: { channel: bridge.channel },
  }).catch(() => undefined);

  return {
    userId: bridge.userId,
    role: bridge.user.role,
    targetPath: bridge.targetPath,
  };
}
