import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * CP-TODO-244：可靠 outbox（CP-FR-070）。
 *
 * - 本地业务写入与出站事件同事务：`enqueueOutboundDispatch` 直接接收调用方事务句柄。
 * - 幂等：idempotencyKey 全局唯一；同 key 同内容返回既有行，同 key 异内容 409 冲突。
 * - 处理：compare-and-set 租约认领、指数退避重试、耗尽进死信（DEAD）；4xx（非 429）
 *   不可重试直接死信；429/5xx/网络错误重试。
 * - 回执与对账：receipt 幂等记录；revision 旧于当前行一律拒绝，旧事件不能覆盖新状态。
 * - 取消/撤权优先：生产侧（如证书撤销/恢复）在同一事务入队，无假成功。
 */

export const DISPATCH_EVENT_TYPES = ["certificate.revoked", "certificate.restored"] as const;
export const CERTIFICATE_LIFECYCLE_DISPATCH_SCOPE = "dispatch:certificates:lifecycle";
export const DISPATCH_PENDING = "PENDING";
export const DISPATCH_PROCESSING = "PROCESSING";
export const DISPATCH_SUCCEEDED = "SUCCEEDED";
export const DISPATCH_DEAD = "DEAD";

const LEASE_WINDOW_MS = 5 * 60_000;
const DEFAULT_RETRY_BASE_MS = 30_000;
const DISPATCH_TIMEOUT_MS = 10_000;

type PrismaLike = Pick<PrismaClient, "outboundDispatch" | "channelClient">;

export type EnqueueResult =
  | { ok: true; id: string; deduplicated: boolean }
  | { ok: false; error: string; status: number };

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function hashDispatchPayload(payload: unknown) {
  return createHash("sha256").update(canonicalize(payload), "utf8").digest("hex");
}

/** 在调用方事务内入队。同 key 同内容幂等返回，同 key 异内容返回 409 冲突。 */
export async function enqueueOutboundDispatch(
  tx: Pick<PrismaClient, "outboundDispatch">,
  input: {
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    revision?: number;
    channelClientId: string;
    maxAttempts?: number;
  },
): Promise<EnqueueResult> {
  const payloadHash = hashDispatchPayload(input.payload);
  try {
    const row = await tx.outboundDispatch.create({
      data: {
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        revision: input.revision ?? 1,
        payloadJson: input.payload as Prisma.InputJsonValue,
        channelClientId: input.channelClientId,
        maxAttempts: input.maxAttempts ?? 5,
      },
      select: { id: true },
    });
    return { ok: true, id: row.id, deduplicated: false };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
      const existing = await tx.outboundDispatch.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, payloadHash: true },
      });
      if (!existing) return { ok: false, error: "Dispatch idempotency conflict.", status: 409 };
      if (existing.payloadHash !== payloadHash) {
        return { ok: false, error: "Dispatch idempotency key reused with different content.", status: 409 };
      }
      return { ok: true, id: existing.id, deduplicated: true };
    }
    throw error;
  }
}

export type DispatchReceipt = { httpStatus: number; body: string | null; receivedAt: string };

function backoffMs(attempts: number, baseMs: number) {
  return baseMs * 2 ** Math.max(0, attempts - 1);
}

/**
 * 处理到期出站事件：租约 CAS 认领 → 传输 → 成功记回执 / 失败退避或死信。
 * deliver 可注入（测试用假传输）；缺省为 HTTP POST 到登记客户端 callbackUrl。
 */
export async function processOutboundDispatches(
  prisma: PrismaLike,
  input: {
    now?: Date;
    limit?: number;
    retryBaseMs?: number;
    deliver?: (row: DispatchRow, client: { callbackUrl: string | null }) => Promise<DispatchReceipt>;
  } = {},
): Promise<{ claimed: number; succeeded: number; retrying: number; dead: number; skipped: number }> {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 10;
  const retryBaseMs = input.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  const deliver = input.deliver ?? deliverDispatchOverHttp;

  const due = await prisma.outboundDispatch.findMany({
    where: {
      status: DISPATCH_PENDING,
      nextRetryAt: { lte: now },
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
    },
    select: { id: true },
    orderBy: [{ nextRetryAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });
  if (due.length === 0) return { claimed: 0, succeeded: 0, retrying: 0, dead: 0, skipped: 0 };

  const claimed = await prisma.outboundDispatch.updateMany({
    where: {
      id: { in: due.map((row) => row.id) },
      status: DISPATCH_PENDING,
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
    },
    data: { status: DISPATCH_PROCESSING, leaseExpiresAt: new Date(now.getTime() + LEASE_WINDOW_MS), attempts: { increment: 1 } },
  });

  const rows = await prisma.outboundDispatch.findMany({
    where: { id: { in: due.map((row) => row.id) }, status: DISPATCH_PROCESSING },
    include: { channelClient: { select: { callbackUrl: true, key: true } } },
  });

  const summary = { claimed: claimed.count, succeeded: 0, retrying: 0, dead: 0, skipped: 0 };
  for (const row of rows) {
    if (!row.channelClient.callbackUrl) {
      await markDead(prisma, row.id, "Channel client has no callbackUrl configured.");
      summary.dead += 1;
      continue;
    }
    try {
      const receipt = await deliver(row as unknown as DispatchRow, { callbackUrl: row.channelClient.callbackUrl });
      if (receipt.httpStatus >= 200 && receipt.httpStatus < 300) {
        await prisma.outboundDispatch.update({
          where: { id: row.id },
          data: { status: DISPATCH_SUCCEEDED, receiptJson: { ...receipt, revision: row.revision }, lastError: null, leaseExpiresAt: null, deliveredAt: now },
        });
        summary.succeeded += 1;
      } else if (receipt.httpStatus === 429 || receipt.httpStatus >= 500) {
        summary[await scheduleRetry(prisma, row, `Callback returned ${receipt.httpStatus}.`, retryBaseMs, now)] += 1;
      } else {
        await markDead(prisma, row.id, `Callback returned non-retryable status ${receipt.httpStatus}.`);
        summary.dead += 1;
      }
    } catch (error) {
      summary[await scheduleRetry(prisma, row, error instanceof Error ? error.message : String(error), retryBaseMs, now)] += 1;
    }
  }
  return summary;
}

export type DispatchRow = {
  id: string;
  eventType: string;
  revision: number;
  payloadJson: unknown;
  attempts: number;
  maxAttempts: number;
};

async function scheduleRetry(prisma: PrismaLike, row: { id: string; attempts: number; maxAttempts: number }, error: string, retryBaseMs: number, now: Date): Promise<"retrying" | "dead"> {
  if (row.attempts >= row.maxAttempts) {
    await markDead(prisma, row.id, `Attempts exhausted (${row.attempts}/${row.maxAttempts}). Last error: ${error}`);
    return "dead";
  }
  await prisma.outboundDispatch.update({
    where: { id: row.id },
    data: {
      status: DISPATCH_PENDING,
      nextRetryAt: new Date(now.getTime() + backoffMs(row.attempts, retryBaseMs)),
      leaseExpiresAt: null,
      lastError: error.slice(0, 500),
    },
  });
  return "retrying";
}

async function markDead(prisma: PrismaLike, id: string, error: string) {
  await prisma.outboundDispatch.update({
    where: { id },
    data: { status: DISPATCH_DEAD, leaseExpiresAt: null, lastError: error.slice(0, 500) },
  });
}

/** 缺省传输：HTTP POST JSON 到登记 callbackUrl，携带幂等/版本头，10 秒超时。 */
export async function deliverDispatchOverHttp(row: DispatchRow, client: { callbackUrl: string }): Promise<DispatchReceipt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
  try {
    const response = await fetch(client.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Dispatch-Id": row.id,
        "X-Dispatch-Idempotency-Key": (row as { idempotencyKey?: string }).idempotencyKey ?? row.id,
        "X-Dispatch-Revision": String(row.revision),
      },
      body: JSON.stringify({
        id: row.id,
        eventType: row.eventType,
        revision: row.revision,
        payload: row.payloadJson,
        occurredAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    const bodyText = await response.text().catch(() => null);
    return { httpStatus: response.status, body: bodyText ? bodyText.slice(0, 1000) : null, receivedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}

/** 对账：接收方回执登记。旧 revision 拒绝；重复相同回执幂等。 */
export async function reconcileOutboundDispatch(
  prisma: Pick<PrismaClient, "outboundDispatch">,
  input: { id: string; receipt: Record<string, unknown>; revision: number },
): Promise<{ ok: true; id: string; applied: boolean } | { ok: false; error: string; status: number }> {
  const row = await prisma.outboundDispatch.findUnique({ where: { id: input.id }, select: { id: true, revision: true, receiptJson: true, status: true } });
  if (!row) return { ok: false, error: "Dispatch not found.", status: 404 };
  if (input.revision < row.revision) {
    return { ok: false, error: "Stale revision: older events must not overwrite newer state.", status: 409 };
  }
  const stored = row.receiptJson as { receipt?: unknown; reconciledRevision?: number } | null;
  const sameReceipt = stored?.receipt !== undefined
    && hashDispatchPayload(stored.receipt) === hashDispatchPayload(input.receipt)
    && stored.reconciledRevision === input.revision;
  if (row.status === DISPATCH_SUCCEEDED && sameReceipt) {
    return { ok: true, id: row.id, applied: false };
  }
  await prisma.outboundDispatch.update({
    where: { id: row.id },
    data: {
      receiptJson: { receipt: input.receipt, reconciledAt: new Date().toISOString(), reconciledRevision: input.revision } as Prisma.InputJsonValue,
      status: DISPATCH_SUCCEEDED,
      deliveredAt: new Date(),
    },
  });
  return { ok: true, id: row.id, applied: true };
}

/** 死信重投（ADMIN）：重置 attempts 并立即到期；审计由调用方路由负责。 */
export async function requeueDeadDispatch(
  prisma: Pick<PrismaClient, "outboundDispatch">,
  input: { id: string; now?: Date },
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const updated = await prisma.outboundDispatch.updateMany({
    where: { id: input.id, status: DISPATCH_DEAD },
    data: { status: DISPATCH_PENDING, attempts: 0, nextRetryAt: input.now ?? new Date(), leaseExpiresAt: null },
  });
  if (updated.count !== 1) return { ok: false, error: "Dispatch is not dead-lettered.", status: 409 };
  return { ok: true, id: input.id };
}

/** 供生产者在事务内选择投递目标：持有 callbackUrl 且 scope 匹配的启用机器客户端。 */
export async function findDispatchTargets(
  prisma: Pick<PrismaClient, "channelClient">,
  scope: string,
): Promise<Array<{ id: string; key: string; callbackUrl: string }>> {
  const clients = await prisma.channelClient.findMany({
    where: { isActive: true, type: "MACHINE", callbackUrl: { not: null } },
    select: { id: true, key: true, callbackUrl: true, allowedScopes: true },
  });
  return clients
    .filter((client) => client.allowedScopes.includes(scope))
    .map((client) => ({ id: client.id, key: client.key, callbackUrl: client.callbackUrl! }));
}
