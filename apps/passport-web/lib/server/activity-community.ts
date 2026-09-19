import type { Activity, User } from "@prisma/client";

export const COMMUNITY_ACTIVITY_TYPES = ["PROJECT", "CHALLENGE"] as const;
export const isCommunityActivity = (activity: Pick<Activity, "type">) => COMMUNITY_ACTIVITY_TYPES.includes(activity.type as (typeof COMMUNITY_ACTIVITY_TYPES)[number]);

/** ADMIN, exact activity organizer, or an explicitly assigned active moderator only. */
export async function canModerateActivityCommunity(user: Pick<User, "id" | "role">, activity: Pick<Activity, "organizerUserId" | "type">, communityId: string) {
  if (!isCommunityActivity(activity)) return false;
  if (user.role === "ADMIN" || activity.organizerUserId === user.id) return true;
  const { getPrismaClient } = await import("@/lib/server/prisma");
  const prisma = getPrismaClient();
  if (!prisma) return false;
  return Boolean(await prisma.activityCommunityMember.findFirst({ where: { communityId, userId: user.id, role: "MODERATOR", status: "ACTIVE" }, select: { id: true } }));
}

export function validateCommunityText(value: unknown, maxLength = 4000): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength || /<[^>]*>|&(?:#\d+|#x[\da-f]+|\w+);/i.test(text)) return null;
  // Do not accept common contact/identity payloads in the community's free-text surface.
  if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b|\b(?:\+?\d[\d ()-]{7,}\d)\b|\b(?:\d[ -]*?){13,19}\b/.test(text)) return null;
  return text;
}
