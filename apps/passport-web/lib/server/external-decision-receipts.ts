import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * CP-TODO-250：外部审核/反馈决定的最小回执（CP-FR-059）。
 *
 * 原则：
 * - 回执保持最小：issuer（经机器认证的登记客户端 key）、对象版本、用途、
 *   决定与 minimalJson 快照；业务评审队列/标准/退修/申诉归 Programme。
 * - 幂等：idempotencyKey 唯一；同键同内容去重返回，同键异内容 409。
 * - 陈旧拒绝：同一 (issuer, object, purpose) 下旧 revision 不能覆盖新决定；
 *   同 revision 异内容 409。反馈类 purpose 不构成发布决定（发布门只认
 *   publication_approval 用途，见 publication-gateway）。
 * - 失效：validUntil 过期或最新决定为 REVOKED 时，该对象+用途视为无有效决定。
 */

export type ReceiptError = { error: string; status: number; code: string };

type PrismaLike = Pick<PrismaClient,
  | "externalDecisionReceipt"
  | "coreAuditLog">;

export const PUBLICATION_APPROVAL_PURPOSE = "publication_approval";

function receiptError(error: string, status: number, code: string): ReceiptError {
  return { error, status, code };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function hashReceiptContent(input: {
  issuerKey: string;
  objectType: string;
  objectId: string;
  objectRevision: number;
  purpose: string;
  decision: string;
  minimalJson: Record<string, unknown>;
}): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(input))).digest("hex");
}

/** 提交决定回执：机器认证由路由完成（issuerKey 即认证客户端 key）。 */
export async function receiveDecisionReceipt(
  prisma: PrismaLike,
  input: {
    issuerKey: string;
    programmeId?: string | null;
    objectType: string;
    objectId: string;
    objectRevision: number;
    purpose: string;
    decision: string;
    minimalJson: Record<string, unknown>;
    signature?: string | null;
    idempotencyKey: string;
    validUntil?: Date | null;
  },
): Promise<{ receiptId: string; deduplicated: boolean } | ReceiptError> {
  if (input.objectRevision < 1) return receiptError("objectRevision must be >= 1.", 400, "INVALID_REQUEST");
  if (input.validUntil && input.validUntil <= new Date()) {
    return receiptError("validUntil must be in the future.", 400, "INVALID_REQUEST");
  }

  // 内容哈希只覆盖 7 个内容字段：idempotencyKey/signature/validUntil 等
  // 传输与元数据字段不参与，保证同键同内容重放、同版本同内容去重可比。
  const contentHash = hashReceiptContent({
    issuerKey: input.issuerKey,
    objectType: input.objectType,
    objectId: input.objectId,
    objectRevision: input.objectRevision,
    purpose: input.purpose,
    decision: input.decision,
    minimalJson: input.minimalJson,
  });

  const existing = await prisma.externalDecisionReceipt.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, issuerKey: true, objectType: true, objectId: true, objectRevision: true, purpose: true, decision: true, minimalJson: true },
  });
  if (existing) {
    const sameContent = hashReceiptContent({
      issuerKey: existing.issuerKey,
      objectType: existing.objectType,
      objectId: existing.objectId,
      objectRevision: existing.objectRevision,
      purpose: existing.purpose,
      decision: existing.decision,
      minimalJson: existing.minimalJson as Record<string, unknown>,
    }) === contentHash && existing.issuerKey === input.issuerKey;
    if (sameContent) return { receiptId: existing.id, deduplicated: true };
    return receiptError("idempotencyKey was already used with different content.", 409, "RECEIPT_CONFLICT");
  }

  const latest = await prisma.externalDecisionReceipt.findFirst({
    where: { issuerKey: input.issuerKey, objectType: input.objectType, objectId: input.objectId, purpose: input.purpose },
    select: { id: true, objectRevision: true, contentHash: true },
    orderBy: [{ objectRevision: "desc" }, { receivedAt: "desc" }],
  });
  if (latest) {
    if (input.objectRevision < latest.objectRevision) {
      return receiptError("A newer decision for this object and purpose already exists.", 409, "RECEIPT_STALE");
    }
    if (input.objectRevision === latest.objectRevision && latest.contentHash !== contentHash) {
      return receiptError("A different decision for the same revision already exists.", 409, "RECEIPT_CONFLICT");
    }
    if (input.objectRevision === latest.objectRevision && latest.contentHash === contentHash) {
      return { receiptId: latest.id, deduplicated: true };
    }
  }

  try {
    const receipt = await prisma.externalDecisionReceipt.create({
      data: {
        issuerKey: input.issuerKey,
        programmeId: input.programmeId ?? null,
        objectType: input.objectType,
        objectId: input.objectId,
        objectRevision: input.objectRevision,
        purpose: input.purpose,
        decision: input.decision,
        minimalJson: input.minimalJson as Prisma.InputJsonValue,
        signature: input.signature ?? null,
        idempotencyKey: input.idempotencyKey,
        contentHash,
        validUntil: input.validUntil ?? null,
      },
      select: { id: true },
    });
    await prisma.coreAuditLog.create({
      data: {
        actorUserId: null,
        action: "decision_receipt.receive",
        subjectType: input.objectType,
        subjectId: input.objectId,
        result: "received",
        metadataJson: {
          receiptId: receipt.id,
          issuerKey: input.issuerKey,
          objectRevision: input.objectRevision,
          purpose: input.purpose,
          decision: input.decision,
        },
      },
    });
    return { receiptId: receipt.id, deduplicated: false };
  } catch (error) {
    console.error("decision receipt receive failed:", error);
    return receiptError("Receipt receive failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/**
 * 最新有效决定：指定对象+用途的最新回执须为 APPROVED、版本达标、未失效。
 */
export async function findAuthoritativeReceipt(
  prisma: Pick<PrismaClient, "externalDecisionReceipt">,
  input: {
    objectType: string;
    objectId: string;
    purpose?: string;
    minRevision?: number;
    at?: Date;
  },
): Promise<{ receipt: Record<string, unknown> | null }> {
  const now = input.at ?? new Date();
  const latest = await prisma.externalDecisionReceipt.findFirst({
    where: {
      objectType: input.objectType,
      objectId: input.objectId,
      ...(input.purpose ? { purpose: input.purpose } : {}),
    },
    orderBy: [{ objectRevision: "desc" }, { receivedAt: "desc" }],
  });
  if (!latest) return { receipt: null };
  if (latest.decision !== "APPROVED") return { receipt: null };
  if (input.minRevision && latest.objectRevision < input.minRevision) return { receipt: null };
  if (latest.validUntil && latest.validUntil <= now) return { receipt: null };
  return { receipt: latest as unknown as Record<string, unknown> };
}

/** 列表：支持对象/用途/issuer 过滤；`cursor` 用于对外端点的 keyset 分页。 */
export async function listDecisionReceipts(
  prisma: Pick<PrismaClient, "externalDecisionReceipt">,
  input: {
    objectType?: string;
    objectId?: string;
    purpose?: string;
    issuerKey?: string;
    take?: number;
    /** 上一页最后一条的 (receivedAt, id)；排序必须是 receivedAt desc, id desc。 */
    cursor?: { receivedAt: Date; id: string } | null;
  },
): Promise<{ receipts: Array<Record<string, unknown>> }> {
  const receipts = await prisma.externalDecisionReceipt.findMany({
    where: {
      ...(input.objectType ? { objectType: input.objectType } : {}),
      ...(input.objectId ? { objectId: input.objectId } : {}),
      ...(input.purpose ? { purpose: input.purpose } : {}),
      ...(input.issuerKey ? { issuerKey: input.issuerKey } : {}),
      ...(input.cursor
        ? {
            OR: [
              { receivedAt: { lt: input.cursor.receivedAt } },
              { AND: [{ receivedAt: input.cursor.receivedAt }, { id: { lt: input.cursor.id } }] },
            ],
          }
        : {}),
    },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: input.take ?? 100,
  });
  return { receipts: receipts as unknown as Array<Record<string, unknown>> };
}
