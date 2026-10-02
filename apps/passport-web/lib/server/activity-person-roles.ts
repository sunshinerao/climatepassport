/**
 * CP-TODO-246: per-person multi-role assignments on an activity (CP-FR-054).
 *
 * 原则：
 * - 一人可任多角色；同一 (activity, person, roleType) 只存在一条指派（幂等指派，不重复建行）。
 * - 统计按人去重：distinctPersonCount 不因一人多角色而双计。
 * - 任职/机构关系不自动产生角色指派；指派须由活动管理者显式创建（或来源系统登记 provenance）。
 */

import type { PrismaClient } from "@prisma/client";

export type PersonRoleError = { error: string; status: number; code: string };

export function personRoleError(status: number, code: string, error: string): PersonRoleError {
  return { error, status, code };
}

type PrismaLike = Pick<PrismaClient, "activityPersonRole" | "person">;

export const ACTIVITY_PERSON_ROLE_TYPES = [
  "APPLICANT",
  "PARTICIPANT",
  "ATTENDEE",
  "SPEAKER",
  "MODERATOR",
  "PANELIST",
  "MENTOR",
  "REVIEWER",
  "VOLUNTEER",
  "ORGANIZER",
  "TEAM_LEADER",
  "TEAM_MEMBER",
  "LEARNER",
  "INSTRUCTOR",
  "PARTNER_REPRESENTATIVE",
  "MEDIA",
] as const;

export type ActivityPersonRoleTypeValue = (typeof ACTIVITY_PERSON_ROLE_TYPES)[number];

export function isActivityPersonRoleType(value: unknown): value is ActivityPersonRoleTypeValue {
  return typeof value === "string" && ACTIVITY_PERSON_ROLE_TYPES.includes(value as ActivityPersonRoleTypeValue);
}

export type ActivityPersonRoleAssignment = {
  id: string;
  activityId: string;
  personId: string;
  roleType: string;
  sourceType: string | null;
  sourceId: string | null;
  note: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function assignActivityPersonRole(
  prisma: PrismaLike,
  input: {
    activityId: string;
    personId: string;
    roleType: string;
    sourceType?: string | null;
    sourceId?: string | null;
    note?: string | null;
    createdByUserId?: string | null;
  }
): Promise<{ assignment: ActivityPersonRoleAssignment; created: boolean } | PersonRoleError> {
  if (!isActivityPersonRoleType(input.roleType)) {
    return personRoleError(400, "INVALID_REQUEST", `roleType must be one of: ${ACTIVITY_PERSON_ROLE_TYPES.join(", ")}`);
  }
  const person = await prisma.person.findUnique({ where: { id: input.personId }, select: { id: true } });
  if (!person) return personRoleError(404, "PARTICIPATION_NOT_FOUND", "Person not found");

  const existing = await prisma.activityPersonRole.findUnique({
    where: {
      activityId_personId_roleType: {
        activityId: input.activityId,
        personId: input.personId,
        roleType: input.roleType,
      },
    },
  });
  if (existing) return { assignment: existing, created: false };

  try {
    const created = await prisma.activityPersonRole.create({
      data: {
        activityId: input.activityId,
        personId: input.personId,
        roleType: input.roleType,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        note: input.note ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
    });
    return { assignment: created, created: true };
  } catch (error) {
    // 并发重复指派：唯一约束竞争失败者重读为幂等返回。
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      const winner = await prisma.activityPersonRole.findUnique({
        where: {
          activityId_personId_roleType: {
            activityId: input.activityId,
            personId: input.personId,
            roleType: input.roleType,
          },
        },
      });
      if (winner) return { assignment: winner, created: false };
    }
    throw error;
  }
}

export async function revokeActivityPersonRole(
  prisma: PrismaLike,
  input: { assignmentId: string; activityId?: string }
): Promise<{ revoked: true } | PersonRoleError> {
  const existing = await prisma.activityPersonRole.findUnique({ where: { id: input.assignmentId } });
  if (!existing || (input.activityId && existing.activityId !== input.activityId)) {
    return personRoleError(404, "PARTICIPATION_NOT_FOUND", "Role assignment not found");
  }
  await prisma.activityPersonRole.delete({ where: { id: existing.id } });
  return { revoked: true };
}

export async function listActivityPeople(
  prisma: PrismaLike,
  activityId: string
): Promise<{
  roles: Array<{ roleType: string; persons: Array<{ assignmentId: string; personId: string; sourceType: string | null; sourceId: string | null; note: string | null }> }>;
  totalAssignments: number;
  distinctPersonCount: number;
}> {
  const rows = await prisma.activityPersonRole.findMany({
    where: { activityId },
    orderBy: [{ roleType: "asc" }, { createdAt: "asc" }],
  });
  const byRole = new Map<string, Array<{ assignmentId: string; personId: string; sourceType: string | null; sourceId: string | null; note: string | null }>>();
  const distinctPersons = new Set<string>();
  for (const row of rows) {
    distinctPersons.add(row.personId);
    const list = byRole.get(row.roleType) ?? [];
    list.push({
      assignmentId: row.id,
      personId: row.personId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      note: row.note,
    });
    byRole.set(row.roleType, list);
  }
  return {
    roles: [...byRole.entries()].map(([roleType, persons]) => ({ roleType, persons })),
    totalAssignments: rows.length,
    distinctPersonCount: distinctPersons.size,
  };
}
