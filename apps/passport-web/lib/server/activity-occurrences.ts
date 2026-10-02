/**
 * CP-TODO-246: generic activity occurrences with atomic admission capacity and
 * waitlist promotion (CP-FR-054/055).
 *
 * 原则：
 * - 每期名额独立；容量扣减只走 compare-and-set（读到 admittedCount 后按值条件更新），
 *   并发确认永不超额。
 * - 确认原子占位：占用名额与申请状态变更在同一事务；占用失败即整笔回滚。
 * - 释放名额（取消确认/改拒绝）同事务按申请时间顺序提升最早候补；提升竞争失败不占名额。
 * - 未携带 occurrenceId 的既有申请路径行为完全不变（夏校冻结兼容控制）。
 */

import type { Prisma, PrismaClient } from "@prisma/client";

export type OccurrenceError = { error: string; status: number; code: string };

export function occurrenceError(status: number, code: string, error: string): OccurrenceError {
  return { error, status, code };
}

/** Prisma JSON 写入：仅在接受显式对象时写入（null 视为不修改，列默认 NULL）。 */
function jsonWrite(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}

type PrismaLike = Pick<
  PrismaClient,
  "activityOccurrence" | "activityApplication" | "activityParticipation"
> & { $transaction: PrismaClient["$transaction"] };

type TxLike = Pick<PrismaClient, "activityOccurrence" | "activityApplication" | "activityParticipation">;

export const ACTIVITY_OCCURRENCE_STATUSES = ["SCHEDULED", "CANCELLED", "COMPLETED"] as const;
export type ActivityOccurrenceStatusValue = (typeof ACTIVITY_OCCURRENCE_STATUSES)[number];

export function isActivityOccurrenceStatus(value: unknown): value is ActivityOccurrenceStatusValue {
  return typeof value === "string" && ACTIVITY_OCCURRENCE_STATUSES.includes(value as ActivityOccurrenceStatusValue);
}

/** 申请可被审核确认的状态（与既有 review 路由合法目标一致；APPROVED 需先释放名额再改）。 */
export const OCCURRENCE_REVIEWABLE_APPLICATION_STATUSES = [
  "SUBMITTED",
  "PENDING_REVIEW",
  "INTERVIEW",
  "OFFERED",
  "WAITLISTED",
] as const;

export type OccurrenceWithAvailability = {
  id: string;
  activityId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  admittedCount: number;
  status: string;
  locationJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  remainingCapacity: number | null;
};

function withAvailability(row: Omit<OccurrenceWithAvailability, "remainingCapacity">): OccurrenceWithAvailability {
  return {
    ...row,
    remainingCapacity: row.capacity == null ? null : Math.max(0, row.capacity - row.admittedCount),
  };
}

export function validateOccurrenceWindow(startsAt: Date, endsAt: Date): OccurrenceError | null {
  if (!(endsAt.getTime() > startsAt.getTime())) {
    return occurrenceError(400, "INVALID_REQUEST", "endsAt must be after startsAt");
  }
  return null;
}

export async function createOccurrence(
  prisma: PrismaLike,
  input: {
    activityId: string;
    startsAt: Date;
    endsAt: Date;
    capacity?: number | null;
    locationJson?: Record<string, unknown> | null;
    status?: ActivityOccurrenceStatusValue;
  }
): Promise<{ occurrence: OccurrenceWithAvailability } | OccurrenceError> {
  const windowError = validateOccurrenceWindow(input.startsAt, input.endsAt);
  if (windowError) return windowError;
  if (input.capacity != null && (!Number.isInteger(input.capacity) || input.capacity < 1)) {
    return occurrenceError(400, "INVALID_REQUEST", "capacity must be a positive integer");
  }
  const created = await prisma.activityOccurrence.create({
    data: {
      activityId: input.activityId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity ?? null,
      locationJson: jsonWrite(input.locationJson),
      status: input.status ?? "SCHEDULED",
    },
  });
  return { occurrence: withAvailability(created) };
}

export async function listOccurrences(
  prisma: PrismaLike,
  activityId: string,
  options: { includeCancelled?: boolean } = {}
): Promise<{ occurrences: OccurrenceWithAvailability[] }> {
  const rows = await prisma.activityOccurrence.findMany({
    where: { activityId, ...(options.includeCancelled ? {} : { status: { not: "CANCELLED" } }) },
    orderBy: { startsAt: "asc" },
  });
  return { occurrences: rows.map(withAvailability) };
}

export async function updateOccurrence(
  prisma: PrismaLike,
  input: {
    occurrenceId: string;
    activityId?: string;
    startsAt?: Date;
    endsAt?: Date;
    capacity?: number | null;
    locationJson?: Record<string, unknown> | null;
    status?: ActivityOccurrenceStatusValue;
  }
): Promise<{ occurrence: OccurrenceWithAvailability } | OccurrenceError> {
  const existing = await prisma.activityOccurrence.findUnique({ where: { id: input.occurrenceId } });
  if (!existing || (input.activityId && existing.activityId !== input.activityId)) {
    return occurrenceError(404, "OCCURRENCE_NOT_FOUND", "Occurrence not found");
  }
  const nextStartsAt = input.startsAt ?? existing.startsAt;
  const nextEndsAt = input.endsAt ?? existing.endsAt;
  const windowError = validateOccurrenceWindow(nextStartsAt, nextEndsAt);
  if (windowError) return windowError;

  if (existing.status !== "SCHEDULED" && (input.capacity !== undefined || input.startsAt || input.endsAt || input.locationJson !== undefined)) {
    return occurrenceError(409, "OCCURRENCE_UNAVAILABLE", `A ${existing.status} occurrence can no longer be modified`);
  }

  if (input.status !== undefined && input.status !== existing.status) {
    if (existing.status !== "SCHEDULED") {
      return occurrenceError(409, "OCCURRENCE_UNAVAILABLE", `Cannot transition a ${existing.status} occurrence to ${input.status}`);
    }
    // 与 cancelOccurrence 同一护栏：占用中的期次不可经本路径取消（修复审查发现的策略分叉）。
    if (input.status === "CANCELLED" && existing.admittedCount > 0) {
      return occurrenceError(
        409,
        "OCCURRENCE_UNAVAILABLE",
        "Occurrence with admitted applicants cannot be cancelled; move them first"
      );
    }
  }

  if (input.capacity !== undefined && input.capacity != null && (!Number.isInteger(input.capacity) || input.capacity < 1)) {
    return occurrenceError(400, "INVALID_REQUEST", "capacity must be a positive integer");
  }

  // 容量 CAS 与字段更新同事务，避免并发占位使守卫过期后仍写入。
  const updated = await prisma.$transaction(async (tx) => {
    if (input.capacity !== undefined) {
      if (input.capacity != null && input.capacity < existing.admittedCount) {
        return occurrenceError(
          409,
          "OCCURRENCE_FULL",
          `capacity cannot be below the admitted count (${existing.admittedCount})`
        );
      }
      // CAS：容量收缩与并发占位互斥（占位只 increment admittedCount，此处要求 admittedCount <= 新容量）。
      const shrunk = await tx.activityOccurrence.updateMany({
        where: {
          id: existing.id,
          admittedCount: { lte: input.capacity ?? Number.MAX_SAFE_INTEGER },
        },
        data: { capacity: input.capacity ?? null },
      });
      if (shrunk.count !== 1) {
        return occurrenceError(409, "OCCURRENCE_FULL", "capacity conflicts with concurrent admissions");
      }
    }

    return {
      occurrence: await tx.activityOccurrence.update({
        where: { id: existing.id },
        data: {
          ...(input.startsAt ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt ? { endsAt: input.endsAt } : {}),
          ...(input.locationJson !== undefined ? { locationJson: jsonWrite(input.locationJson) } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
      }),
    };
  });
  if ("error" in updated) return updated;
  return { occurrence: withAvailability(updated.occurrence) };
}

export async function cancelOccurrence(
  prisma: PrismaLike,
  occurrenceId: string,
  activityId?: string
): Promise<{ occurrence: OccurrenceWithAvailability } | OccurrenceError> {
  const existing = await prisma.activityOccurrence.findUnique({ where: { id: occurrenceId } });
  if (!existing || (activityId && existing.activityId !== activityId)) {
    return occurrenceError(404, "OCCURRENCE_NOT_FOUND", "Occurrence not found");
  }
  if (existing.admittedCount > 0) {
    return occurrenceError(
      409,
      "OCCURRENCE_UNAVAILABLE",
      "Occurrence with admitted applicants cannot be cancelled; move them first"
    );
  }
  // CAS：只允许从 SCHEDULED 取消一次。
  const cancelled = await prisma.activityOccurrence.updateMany({
    where: { id: existing.id, status: "SCHEDULED", admittedCount: 0 },
    data: { status: "CANCELLED" },
  });
  if (cancelled.count !== 1) {
    return occurrenceError(409, "OCCURRENCE_UNAVAILABLE", "Occurrence is no longer cancellable");
  }
  const updated = await prisma.activityOccurrence.findUniqueOrThrow({ where: { id: existing.id } });
  return { occurrence: withAvailability(updated) };
}

/**
 * 原子占位：读取 admittedCount 后以该值为条件 CAS increment。
 * capacity 为 null 表示不限名额。并发下至多一个事务成功，永不超额。
 */
export async function claimOccurrenceSeat(tx: TxLike, occurrenceId: string, activityId?: string): Promise<null | OccurrenceError> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await tx.activityOccurrence.findFirst({
      where: { id: occurrenceId, ...(activityId ? { activityId } : {}) },
    });
    if (!row) return occurrenceError(404, "OCCURRENCE_NOT_FOUND", "Occurrence not found");
    if (row.status !== "SCHEDULED") {
      return occurrenceError(409, "OCCURRENCE_UNAVAILABLE", `Occurrence is ${row.status}`);
    }
    if (row.capacity != null && row.admittedCount >= row.capacity) {
      return occurrenceError(409, "OCCURRENCE_FULL", "Occurrence is at full capacity");
    }
    const claimed = await tx.activityOccurrence.updateMany({
      where: { id: row.id, admittedCount: row.admittedCount, status: "SCHEDULED" },
      data: { admittedCount: { increment: 1 } },
    });
    if (claimed.count === 1) return null;
  }
  return occurrenceError(409, "OCCURRENCE_FULL", "Occurrence seat contention; retry the admission");
}

/** 释放一个已确认名额（admittedCount 递减，底线 0 由 CAS 保证不为负）。 */
export async function releaseOccurrenceSeat(tx: TxLike, occurrenceId: string): Promise<null | OccurrenceError> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await tx.activityOccurrence.findUnique({ where: { id: occurrenceId } });
    if (!row) return occurrenceError(404, "OCCURRENCE_NOT_FOUND", "Occurrence not found");
    if (row.admittedCount <= 0) {
      return occurrenceError(409, "OCCURRENCE_UNAVAILABLE", "Occurrence has no admitted seat to release");
    }
    const released = await tx.activityOccurrence.updateMany({
      where: { id: row.id, admittedCount: row.admittedCount },
      data: { admittedCount: { decrement: 1 } },
    });
    if (released.count === 1) return null;
  }
  return occurrenceError(409, "OCCURRENCE_UNAVAILABLE", "Occurrence seat release contention; retry");
}

async function ensureParticipation(
  tx: TxLike,
  application: { activityId: string; userId: string; roleType: string | null }
): Promise<boolean> {
  const existing = await tx.activityParticipation.findUnique({
    where: { activityId_userId: { activityId: application.activityId, userId: application.userId } },
  });
  if (existing) return false;
  try {
    await tx.activityParticipation.create({
      data: {
        activityId: application.activityId,
        userId: application.userId,
        roleType: (application.roleType as never) ?? undefined,
        status: "ACCEPTED",
      },
    });
    return true;
  } catch (error) {
    // 并发同学录取撞唯一约束：按已存在处理，保证录取幂等且不拖垮整笔事务。
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return false;
    }
    throw error;
  }
}

/**
 * 事务内确认录取：先原子占位，再 CAS 申请状态为 APPROVED 并写入期次；
 * 申请状态竞争失败立即归还名额。返回 participationCreated 供路由决定是否触发奖励。
 */
export async function admitApplicationToOccurrence(
  tx: TxLike,
  input: {
    applicationId: string;
    activityId: string;
    userId: string;
    roleType: string | null;
    occurrenceId: string;
    reviewedByUserId?: string;
    reviewComment?: string;
  }
): Promise<{ applicationId: string; participationCreated: boolean } | OccurrenceError> {
  const seatError = await claimOccurrenceSeat(tx, input.occurrenceId, input.activityId);
  if (seatError) return seatError;

  const admitted = await tx.activityApplication.updateMany({
    where: { id: input.applicationId, status: { in: [...OCCURRENCE_REVIEWABLE_APPLICATION_STATUSES] } },
    data: {
      status: "APPROVED",
      occurrenceId: input.occurrenceId,
      reviewedAt: new Date(),
      ...(input.reviewComment !== undefined ? { reviewComment: input.reviewComment } : {}),
      ...(input.reviewedByUserId ? { reviewedByUserId: input.reviewedByUserId } : {}),
    },
  });
  if (admitted.count !== 1) {
    // 归还失败也必须上抛（路由转为异常回滚整笔，占位随事务撤销），不得静默吞掉。
    const released = await releaseOccurrenceSeat(tx, input.occurrenceId);
    if (released) return released;
    return occurrenceError(409, "INVALID_REQUEST", "Application is no longer in a reviewable status");
  }

  const participationCreated = await ensureParticipation(tx, input);
  return { applicationId: input.applicationId, participationCreated };
}

/**
 * 释放名额后按申请时间提升最早候补（同事务）；无候补或占位竞争失败则名额留空返回 null。
 */
export async function releaseSeatAndPromoteWaitlist(
  tx: TxLike,
  input: { activityId: string; occurrenceId: string }
): Promise<{ promoted: { applicationId: string; userId: string; participationCreated: boolean } | null } | OccurrenceError> {
  const released = await releaseOccurrenceSeat(tx, input.occurrenceId);
  if (released) return released;

  const candidate = await tx.activityApplication.findFirst({
    where: { activityId: input.activityId, occurrenceId: input.occurrenceId, status: "WAITLISTED" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return { promoted: null };

  const seatError = await claimOccurrenceSeat(tx, input.occurrenceId, input.activityId);
  if (seatError) return { promoted: null };

  const promoted = await tx.activityApplication.updateMany({
    where: { id: candidate.id, status: "WAITLISTED" },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });
  if (promoted.count !== 1) {
    const releasedAgain = await releaseOccurrenceSeat(tx, input.occurrenceId);
    if (releasedAgain) return releasedAgain;
    return { promoted: null };
  }

  const participationCreated = await ensureParticipation(tx, candidate);
  return { promoted: { applicationId: candidate.id, userId: candidate.userId, participationCreated } };
}
