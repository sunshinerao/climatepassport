/**
 * Activity reward trigger service.
 * Evaluates ActivityRewardRule entries for a given trigger event and
 * dispatches points / badge / passport-entry rewards.
 *
 * Designed to be called asynchronously after key events:
 *   - REGISTRATION_APPROVED   (application review → APPROVED)
 *   - CHECKIN_COMPLETED       (valid checkin recorded)
 *   - TASK_COMPLETED          (task submission → APPROVED or checkin task done)
 *   - SUBMISSION_APPROVED     (submission review → APPROVED)
 *   - PARTICIPATION_COMPLETED (participation status → COMPLETED or CERTIFIED)
 */

import type { ActivityRewardTrigger } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";
import { enqueueActivityRewardDispatch, processActivityRewardDispatch } from "./activity-reward-dispatch";

// Minimal prisma sub-client type accepted by helpers
type TxClient = Omit<
  NonNullable<ReturnType<typeof getPrismaClient>>,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface TriggerRewardOptions {
  activityId: string;
  userId: string;
  trigger: ActivityRewardTrigger;
  /** Optional: pass Prisma transaction client; falls back to singleton */
  client?: TxClient;
}

/**
 * Evaluate all matching ActivityRewardRule rows and dispatch rewards.
 * Fire-and-forget safe: does not throw on individual rule failure (logs instead).
 */
export async function triggerActivityRewards(opts: TriggerRewardOptions): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;
  // Callers inside an existing business transaction can enqueue atomically.
  // Worker completion is separately durable and never implied by enqueue success.
  const ids = opts.client
    ? await enqueueActivityRewardDispatch(opts.client, opts)
    : await prisma.$transaction(tx => enqueueActivityRewardDispatch(tx, opts));
  if (!opts.client) for (const id of ids) await processActivityRewardDispatch(prisma, id);
}

/**
 * Sync a completed/certified ActivityParticipation to the Passport Timeline.
 * Safe to call multiple times — skips if already synced.
 */
export async function syncParticipationToPassport(
  participationId: string,
  client?: TxClient,
): Promise<void> {
  const prisma = client ?? getPrismaClient();
  if (!prisma) return;

  const p = await prisma.activityParticipation.findUnique({
    where: { id: participationId },
    include: {
      activity: { select: { id: true, title: true, titleEn: true, type: true } },
    },
  });

  if (!p) return;
  if (p.passportSynced) return;
  if (!["COMPLETED", "CERTIFIED"].includes(p.status)) return;

  const existing = await prisma.passportMilestone.findFirst({
    where: { userId: p.userId, activityId: p.activityId, sourceType: "ACTIVITY_PARTICIPATION", sourceId: p.id },
    select: { id: true },
  });

  if (!existing) {
    await prisma.passportMilestone.create({
      data: {
        userId: p.userId,
        activityId: p.activityId,
        title: p.activity?.title ?? "活动参与",
        titleEn: p.activity?.titleEn ?? null,
        sourceType: "ACTIVITY_PARTICIPATION",
        sourceId: p.id,
        certificateIssueId: p.certificateIssueId ?? null,
      },
    });
  }

  await prisma.activityParticipation.update({
    where: { id: p.id },
    data: { passportSynced: true },
  });
}
