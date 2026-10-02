import type { PrismaClient } from "@prisma/client";

export const ACTIVITY_PARTICIPATION_STATUSES = [
  "REGISTERED",
  "ACCEPTED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "ABSENT",
  "CERTIFIED",
  "ARCHIVED",
] as const;

export type ActivityParticipationStatusValue = (typeof ACTIVITY_PARTICIPATION_STATUSES)[number];

const transitions: Record<ActivityParticipationStatusValue, readonly ActivityParticipationStatusValue[]> = {
  REGISTERED: ["ACCEPTED", "CHECKED_IN", "FAILED", "ABSENT", "ARCHIVED"],
  ACCEPTED: ["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "FAILED", "ABSENT", "ARCHIVED"],
  CHECKED_IN: ["IN_PROGRESS", "COMPLETED", "FAILED", "ABSENT", "ARCHIVED"],
  IN_PROGRESS: ["COMPLETED", "FAILED", "ARCHIVED"],
  COMPLETED: ["CERTIFIED", "ARCHIVED"],
  FAILED: ["IN_PROGRESS", "ARCHIVED"],
  ABSENT: ["CHECKED_IN", "ARCHIVED"],
  CERTIFIED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function isActivityParticipationStatus(value: unknown): value is ActivityParticipationStatusValue {
  return typeof value === "string" && ACTIVITY_PARTICIPATION_STATUSES.includes(value as ActivityParticipationStatusValue);
}

export function canTransitionActivityParticipation(
  from: ActivityParticipationStatusValue,
  to: ActivityParticipationStatusValue
) {
  return from === to || transitions[from].includes(to);
}

export type AttendanceCorrectionError = { error: string; status: number; code: string };

/**
 * CP-TODO-246: 出席补录/更正（CP-FR-056）。
 *
 * 原则：
 * - 更正必须有理由（reason 必填），可附受控资产证据引用；理由与证据写入 checkin 记录与审计。
 * - 只成功核验生成出席：已 CHECKED_IN 一律 409，绝不重复记录、不重复奖励（本函数不触发任何奖励）。
 * - 状态迁移遵守参与状态机；CAS 竞争失败返回 409。
 */
export async function recordAttendanceCorrection(
  tx: Pick<PrismaClient, "activityParticipation" | "activityCheckinRecord">,
  input: {
    participationId: string;
    reason: string;
    evidenceAssetIds?: string[];
    checkinAt?: Date;
    actorUserId?: string | null;
  }
): Promise<{ participationId: string; checkinRecordId: string; rewardsTriggered: false } | AttendanceCorrectionError> {
  const reason = input.reason?.trim() ?? "";
  if (!reason) {
    return { error: "Correction reason is required", status: 400, code: "ATTENDANCE_CORRECTION_REASON_REQUIRED" };
  }

  const participation = await tx.activityParticipation.findUnique({ where: { id: input.participationId } });
  if (!participation) {
    return { error: "Participation not found", status: 404, code: "PARTICIPATION_NOT_FOUND" };
  }
  if (participation.status === "CHECKED_IN") {
    return { error: "Attendance is already recorded for this participation", status: 409, code: "ATTENDANCE_ALREADY_RECORDED" };
  }
  if (!canTransitionActivityParticipation(participation.status, "CHECKED_IN")) {
    return {
      error: `Cannot correct attendance from ${participation.status} to CHECKED_IN`,
      status: 409,
      code: "INVALID_REQUEST",
    };
  }

  const corrected = await tx.activityParticipation.updateMany({
    where: { id: participation.id, status: participation.status },
    data: { status: "CHECKED_IN" },
  });
  if (corrected.count !== 1) {
    return { error: "Attendance correction conflicted with a concurrent update", status: 409, code: "ATTENDANCE_ALREADY_RECORDED" };
  }

  const checkinRecord = await tx.activityCheckinRecord.create({
    data: {
      activityId: participation.activityId,
      userId: participation.userId,
      method: "MANUAL",
      status: "VALID",
      verifiedByUserId: input.actorUserId ?? null,
      checkinAt: input.checkinAt ?? new Date(),
      isCorrection: true,
      noteJson: { reason, evidenceAssetIds: input.evidenceAssetIds ?? [] },
    },
  });

  return { participationId: participation.id, checkinRecordId: checkinRecord.id, rewardsTriggered: false };
}
