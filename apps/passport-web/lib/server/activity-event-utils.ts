/**
 * Activity event utilities — adapted from my-app/lib/event-registration.ts
 * for the Activity model in climate-passport.
 */

export interface ActivityRegistrationWindow {
  startTime?: Date | string | null;
  isClosed?: boolean | null;
  registrationCloseAt?: Date | string | null;
}

const DEFAULT_REGISTRATION_GRACE_MINUTES = 60;
const SHANGHAI_UTC_OFFSET_HOURS = 8;

function parseDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 10) : null;
}

function parseTimeParts(value: string | null | undefined): { hours: number; minutes: number } | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
}

function getActivityStartInstant(activity: ActivityRegistrationWindow): Date | null {
  const dateKey = parseDateKey(activity.startTime);
  if (!dateKey) return null;

  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;

  // Use start of day in Shanghai timezone, converted to UTC
  return new Date(
    Date.UTC(year, month - 1, day, -SHANGHAI_UTC_OFFSET_HOURS, 0, 0, 0)
  );
}

/**
 * Returns the registration deadline for an activity.
 * Priority: registrationCloseAt > startTime + grace period
 */
export function getActivityRegistrationDeadline(activity: ActivityRegistrationWindow): Date | null {
  if (activity.registrationCloseAt) {
    const closeAt =
      typeof activity.registrationCloseAt === "string"
        ? new Date(activity.registrationCloseAt)
        : activity.registrationCloseAt;
    if (!Number.isNaN(closeAt.getTime())) {
      return closeAt;
    }
  }

  const startInstant = getActivityStartInstant(activity);
  if (!startInstant) return null;

  return new Date(startInstant.getTime() + DEFAULT_REGISTRATION_GRACE_MINUTES * 60 * 1000);
}

export function isActivityRegistrationDeadlinePassed(
  activity: ActivityRegistrationWindow,
  now = new Date()
): boolean {
  const deadline = getActivityRegistrationDeadline(activity);
  if (!deadline) return false;
  return now.getTime() >= deadline.getTime();
}

export function isActivityRegistrationUnavailable(
  activity: ActivityRegistrationWindow,
  now = new Date()
): boolean {
  return Boolean(activity.isClosed) || isActivityRegistrationDeadlinePassed(activity, now);
}

/**
 * Format a date range label for an activity (e.g. "2026-04-20" or "2026-04-20 ~ 2026-04-22").
 */
export function getActivityDateRangeLabel(
  activity: { startTime?: Date | string | null; endTime?: Date | string | null },
  locale = "zh"
): string {
  const start = activity.startTime ? new Date(activity.startTime) : null;
  const end = activity.endTime ? new Date(activity.endTime) : null;

  if (!start || Number.isNaN(start.getTime())) return locale === "zh" ? "日期待定" : "TBD";

  const fmt = (d: Date) =>
    d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  if (!end || Number.isNaN(end.getTime()) || start.toDateString() === end.toDateString()) {
    return fmt(start);
  }

  return `${fmt(start)} ${locale === "zh" ? "~" : "–"} ${fmt(end)}`;
}

/**
 * Group activities by their start date (YYYY-MM-DD).
 */
export function groupActivitiesByDate<T extends { startTime?: Date | string | null }>(
  activities: T[]
): Record<string, T[]> {
  return activities.reduce((groups, activity) => {
    const date = activity.startTime
      ? new Date(activity.startTime).toISOString().slice(0, 10)
      : "unknown";
    if (!groups[date]) groups[date] = [];
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, T[]>);
}
