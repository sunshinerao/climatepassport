/**
 * Verifier permission helpers for Activity events.
 * Unified replacement for Event-based verifier logic.
 */

import { getPrismaClient } from "./prisma";

type UserRole = string;

export async function canVerifyActivity(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  verifier: { id: string; role: UserRole },
  activityId: string
): Promise<boolean> {
  if (verifier.role === "ADMIN") {
    return true;
  }

  if (verifier.role === "EVENT_MANAGER") {
    const managed = await prisma.activity.findFirst({
      where: { id: activityId, organizerUserId: verifier.id },
      select: { id: true },
    });
    return Boolean(managed);
  }

  if (verifier.role === "VERIFIER") {
    // Check if verifier is assigned to this activity via ActivityRole
    const role = await prisma.activityRole.findUnique({
      where: {
        activityId_roleType: {
          activityId,
          roleType: "VERIFIER" as any,
        },
      },
      select: { id: true },
    });

    if (!role) {
      return false;
    }

    // Check if the verifier has an active participation with this role
    const participation = await prisma.activityParticipation.findFirst({
      where: {
        activityId,
        userId: verifier.id,
        status: { in: ["REGISTERED", "ACCEPTED", "CHECKED_IN"] },
      },
      select: { id: true },
    });

    return Boolean(participation);
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
    const participations = await prisma.activityParticipation.findMany({
      where: {
        userId: actor.id,
        status: { in: ["REGISTERED", "ACCEPTED", "CHECKED_IN"] },
      },
      include: {
        activity: {
          select: { id: true, title: true, titleEn: true, startTime: true, slug: true },
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return participations
      .map((p) => ({
        id: p.activityId,
        title: "", // Will be fetched separately if needed
        titleEn: null,
        startTime: null,
        slug: "",
      }))
      .filter(Boolean) as Array<{
      id: string;
      title: string;
      titleEn: string | null;
      startTime: Date | null;
      slug: string;
    }>;

    // Fetch activity details
    const activityIds = participations.map((p) => p.activityId);
    const activities = await (prisma as NonNullable<typeof prisma>).activity.findMany({
      where: { id: { in: activityIds } },
      select: { id: true, title: true, titleEn: true, startTime: true, slug: true },
    });
    const activityMap = new Map(activities.map((a) => [a.id, a]));
    return participations.map((p) => {
      const a = activityMap.get(p.activityId);
      return {
        id: p.activityId,
        title: a?.title ?? "",
        titleEn: a?.titleEn ?? null,
        startTime: a?.startTime ?? null,
        slug: a?.slug ?? "",
      };
    });
  }

  return [];
}
