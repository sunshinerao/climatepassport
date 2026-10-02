/**
 * CP-TODO-257：通知投递、重试证据与偏好（CP-FR-066）。
 *
 * 原则：
 * - 事务成功后通知可重试：每次投递（成功/失败/跳过）都落 NotificationAttempt，
 *   失败按指数退避重排（nextRetryAt），超限死信（deadLetteredAt），死信可审计。
 * - 邮件不附私密正文：EMAIL 渠道只发送标题与定位链接（actionUrl），正文永不外发。
 * - 用户偏好复用既有 notification_preferences（email/inApp/sms/marketing 开关）；
 *   渠道被关闭即跳过投递（SKIPPED）并死信，不无限重试。
 * - programme 负责通知触发与措辞；CP 只保证投递范围、模板安全与幂等。
 */

import type { PrismaClient } from "@prisma/client";

export type DeliveryError = { error: string; status: number; code: string };

export function deliveryError(status: number, code: string, error: string): DeliveryError {
  return { error, status, code };
}

type PrismaLike = Pick<
  PrismaClient,
  "notification" | "notificationAttempt" | "notificationPreference" | "user"
> & { $transaction: PrismaClient["$transaction"] };

export const NOTIFICATION_DELIVERY_MAX_ATTEMPTS = 5;
export const NOTIFICATION_DELIVERY_BASE_BACKOFF_MS = 60_000;

export type DeliveryOutcome = "DELIVERED" | "SKIPPED" | "RETRYING" | "DEAD";

export async function isChannelOptedOut(
  prisma: Pick<PrismaClient, "notificationPreference">,
  input: { userId: string; channel: string; marketing: boolean }
): Promise<boolean> {
  const preference = await prisma.notificationPreference.findUnique({ where: { userId: input.userId } });
  const defaults = { emailEnabled: true, inAppEnabled: true, smsEnabled: false, marketingEnabled: false };
  const flags = preference ?? defaults;
  if (input.marketing && !flags.marketingEnabled) return true;
  if (input.channel === "EMAIL") return !flags.emailEnabled;
  if (input.channel === "IN_APP") return !flags.inAppEnabled;
  if (input.channel === "SMS") return !flags.smsEnabled;
  return false;
}

function backoffFor(attempt: number, baseBackoffMs: number): number {
  return baseBackoffMs * 2 ** Math.max(0, attempt - 1);
}

export async function deliverNotification(
  prisma: PrismaLike,
  input: {
    notificationId: string;
    maxAttempts?: number;
    baseBackoffMs?: number;
    now?: Date;
  }
): Promise<{ notificationId: string; outcome: DeliveryOutcome; attempts: number } | DeliveryError> {
  const maxAttempts = input.maxAttempts ?? NOTIFICATION_DELIVERY_MAX_ATTEMPTS;
  const baseBackoffMs = input.baseBackoffMs ?? NOTIFICATION_DELIVERY_BASE_BACKOFF_MS;
  const now = input.now ?? new Date();

  const notification = await prisma.notification.findUnique({ where: { id: input.notificationId } });
  if (!notification) return deliveryError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  if (notification.deadLetteredAt) return { notificationId: notification.id, outcome: "DEAD", attempts: 0 };
  if (notification.status !== "QUEUED") return { notificationId: notification.id, outcome: "DELIVERED", attempts: 0 };

  const previousAttempts = await prisma.notificationAttempt.findMany({ where: { notificationId: notification.id } });
  const attemptNumber = previousAttempts.length + 1;

  const recordAttempt = async (
    tx: Pick<PrismaClient, "notificationAttempt">,
    result: string,
    error: string | null
  ) => {
    await tx.notificationAttempt.create({
      data: {
        notificationId: notification.id,
        channel: notification.channel,
        attempt: attemptNumber,
        result,
        error,
        actorUserId: null,
      },
    });
  };

  const marketing = Boolean((notification.metadata as { marketing?: boolean } | null)?.marketing);
  if (await isChannelOptedOut(prisma, { userId: notification.userId, channel: notification.channel, marketing })) {
    await prisma.$transaction(async (tx) => {
      await recordAttempt(tx, "SKIPPED", "channel opted out");
      await tx.notification.updateMany({
        where: { id: notification.id, status: "QUEUED" },
        data: { deadLetteredAt: now },
      });
    });
    return { notificationId: notification.id, outcome: "SKIPPED", attempts: attemptNumber };
  }

  if (notification.channel === "IN_APP") {
    await prisma.$transaction(async (tx) => {
      await recordAttempt(tx, "SUCCESS", null);
      await tx.notification.updateMany({
        where: { id: notification.id, status: "QUEUED" },
        data: { status: "DELIVERED", deliveredAt: now },
      });
    });
    return { notificationId: notification.id, outcome: "DELIVERED", attempts: attemptNumber };
  }

  // EMAIL/SMS：只发标题与定位链接，私密正文（body/bodyEn）绝不进入邮件。
  const recipient = await prisma.user.findUnique({ where: { id: notification.userId }, select: { email: true } });
  if (!recipient) {
    await prisma.$transaction(async (tx) => {
      await recordAttempt(tx, "FAILED", "recipient missing");
      await tx.notification.updateMany({ where: { id: notification.id, status: "QUEUED" }, data: { deadLetteredAt: now } });
    });
    return { notificationId: notification.id, outcome: "DEAD", attempts: attemptNumber };
  }
  const subject = notification.titleEn ?? notification.title;
  const text = [notification.titleEn ?? notification.title, notification.actionUrl ? `Open: ${notification.actionUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");
  try {
    const { sendTransactionalMail } = await import("./mailer");
    await sendTransactionalMail({ to: recipient.email, subject, html: `<p>${text.replace(/\n/g, "<br/>")}</p>`, text });
    await prisma.$transaction(async (tx) => {
      await recordAttempt(tx, "SUCCESS", null);
      await tx.notification.updateMany({
        where: { id: notification.id, status: "QUEUED" },
        data: { status: "DELIVERED", deliveredAt: now },
      });
    });
    return { notificationId: notification.id, outcome: "DELIVERED", attempts: attemptNumber };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dead = attemptNumber >= maxAttempts;
    await prisma.$transaction(async (tx) => {
      await recordAttempt(tx, "FAILED", message);
      await tx.notification.updateMany({
        where: { id: notification.id, status: "QUEUED" },
        data: dead
          ? { deadLetteredAt: now }
          : { nextRetryAt: new Date(now.getTime() + backoffFor(attemptNumber, baseBackoffMs)) },
      });
    });
    return { notificationId: notification.id, outcome: dead ? "DEAD" : "RETRYING", attempts: attemptNumber };
  }
}

export async function processDueNotifications(
  prisma: PrismaLike,
  input: { limit?: number; maxAttempts?: number; baseBackoffMs?: number; now?: Date } = {}
): Promise<{ processed: number; delivered: number; skipped: number; retrying: number; dead: number }> {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 20;
  const due = await prisma.notification.findMany({
    where: {
      status: "QUEUED",
      deadLetteredAt: null,
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const totals = { processed: 0, delivered: 0, skipped: 0, retrying: 0, dead: 0 };
  for (const notification of due) {
    const result = await deliverNotification(prisma, {
      notificationId: notification.id,
      maxAttempts: input.maxAttempts,
      baseBackoffMs: input.baseBackoffMs,
      now,
    });
    if ("error" in result) continue;
    totals.processed += 1;
    if (result.outcome === "DELIVERED") totals.delivered += 1;
    if (result.outcome === "SKIPPED") totals.skipped += 1;
    if (result.outcome === "RETRYING") totals.retrying += 1;
    if (result.outcome === "DEAD") totals.dead += 1;
  }
  return totals;
}

export async function listDeliveryAttempts(
  prisma: Pick<PrismaClient, "notificationAttempt">,
  notificationId: string
): Promise<{ attempts: Array<{ id: string; channel: string; attempt: number; result: string; error: string | null; createdAt: Date }> }> {
  const attempts = await prisma.notificationAttempt.findMany({
    where: { notificationId },
    orderBy: { attempt: "asc" },
  });
  return { attempts };
}
