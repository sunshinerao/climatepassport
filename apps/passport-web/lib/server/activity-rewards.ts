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

import type { ActivityRewardTrigger, Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";
import { grantUserPoints } from "@/lib/server/point-ledger";

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
  const prisma = opts.client ?? getPrismaClient();
  if (!prisma) return;

  // Load matching rules
  const rules = await prisma.activityRewardRule.findMany({
    where: { activityId: opts.activityId, trigger: opts.trigger },
  });

  if (rules.length === 0) return;

  // Load activity for label use
  const activity = await prisma.activity.findUnique({
    where: { id: opts.activityId },
    select: { title: true, titleEn: true },
  });

  for (const rule of rules) {
    try {
      await applyRewardRule(prisma, rule, opts.userId, activity);
    } catch (err) {
      // Do not fail the caller on individual rule errors
      console.error("[activity-rewards] rule apply error", { ruleId: rule.id, err });
    }
  }
}

async function applyRewardRule(
  prisma: TxClient,
  rule: {
    id: string;
    activityId: string;
    rewardType: string;
    rewardValueJson: Prisma.JsonValue;
  },
  userId: string,
  activity: { title: string; titleEn: string | null } | null,
) {
  const value = rule.rewardValueJson as Record<string, unknown>;
  const idempotencyKey = `reward:${rule.id}:${userId}`;

  switch (rule.rewardType) {
    case "POINTS": {
      const points = typeof value.points === "number" ? value.points : 0;
      if (points <= 0) break;
      await grantUserPoints({
        userId,
        points,
        type: "ACTIVITY_REWARD",
        description: `活动奖励 — ${activity?.title ?? rule.activityId}`,
        idempotencyKey,
        client: prisma as Parameters<typeof grantUserPoints>[0]["client"],
      });
      break;
    }

    case "BADGE": {
      const badgeDefinitionId = typeof value.badgeDefinitionId === "string" ? value.badgeDefinitionId : null;
      if (!badgeDefinitionId) break;

      // Idempotency: skip if user already has this badge award for this rule
      const existing = await prisma.badgeAward.findFirst({
        where: { userId, badgeDefinitionId, evidenceSnapshotJson: { path: ["rewardRuleId"], equals: rule.id } },
        select: { id: true },
      });
      if (existing) break;

      const award = await prisma.badgeAward.create({
        data: {
          userId,
          badgeDefinitionId,
          evidenceSnapshotJson: { rewardRuleId: rule.id, activityId: rule.activityId },
        },
      });

      // Append to the participation's badgeAwardIds array
      await prisma.activityParticipation.updateMany({
        where: { activityId: rule.activityId, userId },
        data: { badgeAwardIds: { push: award.id } },
      });
      break;
    }

    case "PASSPORT_ENTRY": {
      // Write a PassportMilestone entry if not already done
      const existing = await prisma.passportMilestone.findFirst({
        where: { userId, activityId: rule.activityId, sourceType: "ACTIVITY_REWARD", sourceId: rule.id },
        select: { id: true },
      });
      if (existing) break;

      await prisma.passportMilestone.create({
        data: {
          userId,
          activityId: rule.activityId,
          title: activity?.title ?? "活动参与",
          titleEn: activity?.titleEn ?? null,
          sourceType: "ACTIVITY_REWARD",
          sourceId: rule.id,
        },
      });
      break;
    }

    // BADGE, CERTIFICATE, SKILL_TAG, LEADERBOARD, NOTIFICATION:
    // these require deeper integration with badge/cert systems.
    // Log intent; full wiring added in P2.3+ per plan.
    default: {
      console.info("[activity-rewards] deferred reward type", {
        rewardType: rule.rewardType,
        ruleId: rule.id,
        userId,
      });
      break;
    }
  }
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
