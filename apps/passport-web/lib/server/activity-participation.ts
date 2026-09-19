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
