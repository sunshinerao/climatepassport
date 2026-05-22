import { createHash, randomBytes } from "crypto";
import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/site-content";
import { getPrismaClient } from "@/lib/server/prisma";

const SESSION_COOKIE_NAME = "climate-passport-session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PASSPORT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_HASH_PREFIX = /^\$2[aby]\$/;

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
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

  if (PASSWORD_HASH_PREFIX.test(storedPassword)) {
    return compare(inputPassword, storedPassword);
  }

  return storedPassword === inputPassword;
}

function randomPassportChunk(length: number) {
  const bytes = randomBytes(length);
  let output = "";

  for (let index = 0; index < length; index += 1) {
    output += PASSPORT_ALPHABET[bytes[index] % PASSPORT_ALPHABET.length];
  }

  return output;
}

function hashBridgeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildPassportCandidate() {
  return `${randomPassportChunk(7)}-${randomPassportChunk(6)}`;
}

export async function generateClimatePassportId() {
  const prisma = getPrismaClient();

  if (!prisma) {
    return buildPassportCandidate();
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = buildPassportCandidate();
    const existing = await prisma.user.findUnique({
      where: { climatePassportId: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Unable to allocate a unique Climate Passport ID.");
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
      targetPath: options.targetPath ?? null,
      expiresAt,
    },
  });

  const payload: BridgeTokenPayload = {
    token: rawToken,
    channel: "SHCW",
    expiresAt: expiresAt.toISOString(),
    targetPath: options.targetPath ?? null,
  };

  return payload;
}

export async function exchangeChannelBridgeToken(token: string) {
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
        },
      },
    },
  });

  if (!bridge || bridge.channel !== "SHCW") {
    return null;
  }

  if (bridge.consumedAt || bridge.expiresAt <= new Date()) {
    return null;
  }

  await prisma.channelSessionBridge.update({
    where: { id: bridge.id },
    data: { consumedAt: new Date() },
  });

  await createUserSession(bridge.userId);

  return {
    userId: bridge.userId,
    role: bridge.user.role,
    targetPath: bridge.targetPath,
  };
}
