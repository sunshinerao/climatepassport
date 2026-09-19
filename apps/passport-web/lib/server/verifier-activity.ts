/**
 * Verifier permission helpers for Activity events.
 * Unified replacement for Event-based verifier logic.
 */

import { getPrismaClient } from "./prisma";

type UserRole = string;

export async function canManageActivity(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  actor: { id: string; role: UserRole },
  activityId: string
): Promise<boolean> {
  if (actor.role === "ADMIN") {
    return true;
  }

  if (actor.role !== "EVENT_MANAGER") {
    return false;
  }

  const managed = await prisma.activity.findFirst({
    where: { id: activityId, organizerUserId: actor.id },
    select: { id: true },
  });
  return Boolean(managed);
}

/** Phase 1 deliberately supports unconditional rules only. */
export function isEmptyCertificateCondition(value: unknown) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

export async function canVerifyActivity(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  verifier: { id: string; role: UserRole },
  activityId: string
): Promise<boolean> {
  if (verifier.role === "ADMIN") {
    return true;
  }

  if (verifier.role === "EVENT_MANAGER") {
    return canManageActivity(prisma, verifier, activityId);
  }

  if (verifier.role === "VERIFIER") {
    const assignment = await prisma.activityVerifier.findUnique({
      where: {
        userId_activityId: {
          userId: verifier.id,
          activityId,
        },
      },
      select: { id: true },
    });
    return Boolean(assignment);
  }

  return false;
}

export async function loadVerifiableActivities(
  actor: { id: string; role: UserRole },
  limit = 60
): Promise<
  Array<{
    id: string;
    title: string;
    titleEn: string | null;
    startTime: Date | null;
    slug: string;
  }>
> {
  const prisma = getPrismaClient();
  if (!prisma) return [];

  if (actor.role === "ADMIN") {
    return prisma.activity.findMany({
      where: { status: { in: ["PUBLISHED", "ONGOING"] } },
      take: limit,
      orderBy: { startTime: "asc" },
      select: { id: true, title: true, titleEn: true, startTime: true, slug: true },
    });
  }

  if (actor.role === "EVENT_MANAGER") {
    return prisma.activity.findMany({
      where: { organizerUserId: actor.id, status: { in: ["PUBLISHED", "ONGOING"] } },
      take: limit,
      orderBy: { startTime: "asc" },
      select: { id: true, title: true, titleEn: true, startTime: true, slug: true },
    });
  }

  if (actor.role === "VERIFIER") {
    const assignments = await prisma.activityVerifier.findMany({
      where: {
        userId: actor.id,
        activity: { status: { in: ["PUBLISHED", "ONGOING"] } },
      },
      include: {
        activity: {
          select: { id: true, title: true, titleEn: true, startTime: true, slug: true },
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return assignments.map(({ activity }) => activity);
  }

  return [];
}
