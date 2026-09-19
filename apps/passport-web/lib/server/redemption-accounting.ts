import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";

/** Server-only, provider-neutral internal redemption accounting. No provider is invoked here. */
export type RedemptionActor = { userId: string; role: string };
export type RedemptionOperation = "reserve" | "cancel" | "expire" | "settle" | "refund";
type Tx = any;

const ADMIN_ONLY = new Set<RedemptionOperation>(["settle", "refund"]);
const FROM_STATUS: Record<RedemptionOperation, string> = {
  reserve: "CREATED", cancel: "RESERVED", expire: "RESERVED", settle: "RESERVED", refund: "SETTLED",
};
const TO_STATUS: Record<RedemptionOperation, string> = {
  reserve: "RESERVED", cancel: "CANCELLED", expire: "EXPIRED", settle: "SETTLED", refund: "REFUNDED",
};

function requireActor(actor: RedemptionActor, operation?: RedemptionOperation) {
  if (!actor?.userId || !actor.role) throw new Error("Authenticated actor context is required.");
  if (operation && ADMIN_ONLY.has(operation) && actor.role !== "ADMIN") {
    throw new Error("Administrator role required.");
  }
}

export function redemptionPostingPairs(operation: RedemptionOperation) {
  if (operation === "reserve") return [{ account: "USER_AVAILABLE", direction: "DEBIT" }, { account: "USER_RESERVED", direction: "CREDIT" }];
  if (operation === "settle") return [{ account: "USER_RESERVED", direction: "DEBIT" }, { account: "REDEMPTION_CLEARING", direction: "CREDIT" }];
  if (operation === "refund") return [{ account: "REDEMPTION_CLEARING", direction: "DEBIT" }, { account: "USER_AVAILABLE", direction: "CREDIT" }];
  return [{ account: "USER_RESERVED", direction: "DEBIT" }, { account: "USER_AVAILABLE", direction: "CREDIT" }];
}

async function withSerializableRetry<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable.");
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      lastError = error;
      if (error?.code !== "P2034" || attempt === 2) throw error;
    }
  }
  throw lastError;
}

async function writeMetadata(tx: Tx, input: { intentId: string; userId: string; actor: RedemptionActor; operation: string; points: number; status: string }) {
  const metadata = { intentId: input.intentId, operation: input.operation, points: input.points, status: input.status };
  await tx.coreAuditLog.create({ data: { actorUserId: input.actor.userId, action: `redemption.${input.operation}`, subjectType: "RedemptionIntent", subjectId: input.intentId, result: "success", metadataJson: metadata } });
  await tx.notification.create({ data: { userId: input.userId, channel: "IN_APP", kind: "SYSTEM", title: "Redemption status updated", body: `Redemption ${input.status.toLowerCase()}.`, metadata } });
}

export async function createRedemptionIntent(input: { actor: RedemptionActor; userId: string; points: number; idempotencyKey: string; expiresAt?: Date | null }) {
  requireActor(input.actor);
  if (input.actor.userId !== input.userId && input.actor.role !== "ADMIN") throw new Error("Actor may only create own redemption intent.");
  const points = Math.trunc(input.points);
  if (!Number.isFinite(points) || points <= 0 || !input.idempotencyKey) throw new Error("Positive points and idempotency key are required.");
  return withSerializableRetry(async (tx) => {
    const existing = await tx.redemptionIntent.findUnique({ where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } } });
    if (existing) return { intent: existing, idempotent: true };
    const intent = await tx.redemptionIntent.create({ data: { userId: input.userId, points, idempotencyKey: input.idempotencyKey, expiresAt: input.expiresAt ?? null } });
    await writeMetadata(tx, { intentId: intent.id, userId: intent.userId, actor: input.actor, operation: "create", points, status: intent.status });
    return { intent, idempotent: false };
  });
}

export async function transitionRedemptionIntent(input: { actor: RedemptionActor; intentId: string; operation: RedemptionOperation; idempotencyKey: string }) {
  requireActor(input.actor, input.operation);
  if (!input.idempotencyKey) throw new Error("Journal idempotency key is required.");
  return withSerializableRetry(async (tx) => {
    const existing = await tx.pointJournal.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { intent: true } });
    if (existing) return { intent: existing.intent, idempotent: true };
    const intent = await tx.redemptionIntent.findUnique({ where: { id: input.intentId } });
    if (!intent) throw new Error("Redemption intent not found.");
    if (input.actor.userId !== intent.userId && input.actor.role !== "ADMIN") throw new Error("Actor may only change own redemption intent.");
    if (intent.status !== FROM_STATUS[input.operation]) throw new Error(`Cannot ${input.operation} redemption intent in ${intent.status} state.`);
    if (input.operation === "reserve") {
      const available = await availablePointsInTransaction(tx, intent.userId);
      if (available < intent.points) throw new Error("Insufficient available points.");
    }
    const journal = await tx.pointJournal.create({ data: { intentId: intent.id, type: input.operation.toUpperCase(), idempotencyKey: input.idempotencyKey } });
    await tx.pointPosting.createMany({ data: redemptionPostingPairs(input.operation).map((posting) => ({ ...posting, journalId: journal.id, points: intent.points })) });
    const updated = await tx.redemptionIntent.update({ where: { id: intent.id }, data: { status: TO_STATUS[input.operation] } });
    await writeMetadata(tx, { intentId: intent.id, userId: intent.userId, actor: input.actor, operation: input.operation, points: intent.points, status: updated.status });
    return { intent: updated, idempotent: false };
  });
}

/** USER_AVAILABLE is a double-entry representation only. Until ledger cutover,
 * available redemption points deliberately remain legacy User.points minus reservations. */
export function availablePointsFromLegacyBalance(legacyPoints: number, postings: Array<{ direction: string; points: number }>) {
  const reserved = postings.reduce((total, posting) => total + (posting.direction === "CREDIT" ? posting.points : -posting.points), 0);
  return legacyPoints - reserved;
}

export async function availablePointsInTransaction(tx: Tx, userId: string) {
  const [user, postings] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { points: true } }),
    tx.pointPosting.findMany({ where: { account: "USER_RESERVED", journal: { intent: { userId } } }, select: { direction: true, points: true } }),
  ]);
  if (!user) throw new Error("User not found.");
  return availablePointsFromLegacyBalance(user.points, postings);
}

export async function getAvailableRedemptionPoints(actor: RedemptionActor, userId: string) {
  requireActor(actor);
  if (actor.userId !== userId && actor.role !== "ADMIN") throw new Error("Actor may only view own available points.");
  return withSerializableRetry((tx) => availablePointsInTransaction(tx, userId));
}

export const reserveRedemptionIntent = (input: Omit<Parameters<typeof transitionRedemptionIntent>[0], "operation">) =>
  transitionRedemptionIntent({ ...input, operation: "reserve" });
export const cancelRedemptionIntent = (input: Omit<Parameters<typeof transitionRedemptionIntent>[0], "operation">) =>
  transitionRedemptionIntent({ ...input, operation: "cancel" });
export const expireRedemptionIntent = (input: Omit<Parameters<typeof transitionRedemptionIntent>[0], "operation">) =>
  transitionRedemptionIntent({ ...input, operation: "expire" });
export const settleRedemptionIntent = (input: Omit<Parameters<typeof transitionRedemptionIntent>[0], "operation">) =>
  transitionRedemptionIntent({ ...input, operation: "settle" });
export const refundRedemptionIntent = (input: Omit<Parameters<typeof transitionRedemptionIntent>[0], "operation">) =>
  transitionRedemptionIntent({ ...input, operation: "refund" });

export const redemptionProviderAdapters = Object.freeze({});
export type RedemptionProviderAdapter = { readonly name: string; readonly enabled: false };
