import type { UserRole } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";

export type VerifiableEvent = {
  id: string;
  title: string;
  titleEn: string | null;
  startDate: Date;
  isPublished: boolean;
  source: "ADMIN" | "MANAGER" | "ASSIGNMENT";
};

/**
 * Returns the events a verifier user is allowed to confirm event check-ins for.
 *
 * - ADMIN: every event (capped).
 * - EVENT_MANAGER: events they manage.
 * - VERIFIER: events they were assigned to via EventVerifier.
 * Other roles get an empty list.
 */
export async function loadVerifiableEvents(actor: { id: string; role: UserRole }, limit = 60): Promise<VerifiableEvent[]> {
  const prisma = getPrismaClient();
  if (!prisma) return [];

  const baseSelect = {
    id: true,
    title: true,
    titleEn: true,
    startDate: true,
    isPublished: true,
  };

  if (actor.role === "ADMIN") {
    const events = await prisma.event.findMany({
      where: { isPublished: true },
      orderBy: { startDate: "asc" },
      take: limit,
      select: baseSelect,
    });
    return events.map((event) => ({ ...event, source: "ADMIN" as const }));
  }

  if (actor.role === "EVENT_MANAGER") {
    const events = await prisma.event.findMany({
      where: { managerUserId: actor.id },
      orderBy: { startDate: "asc" },
      take: limit,
      select: baseSelect,
    });
    return events.map((event) => ({ ...event, source: "MANAGER" as const }));
  }

  if (actor.role === "VERIFIER") {
    const assignments = await prisma.eventVerifier.findMany({
      where: { userId: actor.id },
      take: limit,
      include: { event: { select: baseSelect } },
      orderBy: { createdAt: "desc" },
    });
    return assignments
      .filter((assignment) => assignment.event)
      .map((assignment) => ({ ...assignment.event!, source: "ASSIGNMENT" as const }));
  }

  return [];
}
