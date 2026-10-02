/**
 * CP-TODO-246: external taxonomy classification references on activities (CP-FR-054).
 *
 * 原则：
 * - programme 负责其分类/立项规则；CP 只保存合法版本投影（taxonomySystem + taxonomyRef
 *   + 版本 + 展示标签），不内置任何业务分类体系。
 * - 版本单调：同 (activity, taxonomySystem, taxonomyRef) 只接受更高 sourceVersion；
 *   旧版本一律 409 TAXONOMY_STALE，撤回版本可用更高版本重新登记。
 * - 幂等键 + 内容哈希：同键同内容去重返回，同键异内容 409 TAXONOMY_CONFLICT。
 * - 关键写入与 core_audit_logs 同一事务。
 */

import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

export type TaxonomyError = { error: string; status: number; code: string };

export function taxonomyError(status: number, code: string, error: string): TaxonomyError {
  return { error, status, code };
}

type PrismaLike = Pick<PrismaClient, "activity" | "activityExternalClassification" | "coreAuditLog"> & {
  $transaction: PrismaClient["$transaction"];
};

export type ActivityClassification = {
  id: string;
  activityId: string;
  taxonomySystem: string;
  taxonomyRef: string;
  labelJson: Prisma.JsonValue | null;
  sourceVersion: number;
  status: string;
  idempotencyKey: string | null;
  contentHash: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** 仅在接受显式对象时写入 JSON 列（null 视为保留原值）。 */
function jsonWrite(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function classificationContentHash(input: {
  activityId: string;
  taxonomySystem: string;
  taxonomyRef: string;
  labelJson: unknown;
  sourceVersion: number;
}): string {
  return createHash("sha256")
    .update(
      stableStringify({
        activityId: input.activityId,
        taxonomySystem: input.taxonomySystem,
        taxonomyRef: input.taxonomyRef,
        labelJson: input.labelJson ?? null,
        sourceVersion: input.sourceVersion,
      })
    )
    .digest("hex");
}

async function assertActivityExists(prisma: PrismaLike, activityId: string): Promise<TaxonomyError | null> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true } });
  if (!activity) return taxonomyError(404, "TAXONOMY_NOT_FOUND", "Activity not found");
  return null;
}

export async function setActivityClassification(
  prisma: PrismaLike,
  input: {
    activityId: string;
    taxonomySystem: string;
    taxonomyRef: string;
    labelJson?: Record<string, unknown> | null;
    sourceVersion?: number;
    idempotencyKey: string;
    auditActorUserId?: string | null;
  }
): Promise<{ classification: ActivityClassification; deduplicated: boolean } | TaxonomyError> {
  const activityError = await assertActivityExists(prisma, input.activityId);
  if (activityError) return activityError;

  const sourceVersion = input.sourceVersion ?? 1;
  const contentHash = classificationContentHash({ ...input, labelJson: input.labelJson ?? null, sourceVersion });

  const byKey = await prisma.activityExternalClassification.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (byKey) {
    if (byKey.contentHash !== contentHash) {
      return taxonomyError(409, "TAXONOMY_CONFLICT", "idempotencyKey was already used with different content");
    }
    return { classification: byKey, deduplicated: true };
  }

  const existing = await prisma.activityExternalClassification.findUnique({
    where: {
      activityId_taxonomySystem_taxonomyRef: {
        activityId: input.activityId,
        taxonomySystem: input.taxonomySystem,
        taxonomyRef: input.taxonomyRef,
      },
    },
  });

  if (existing) {
    if (sourceVersion < existing.sourceVersion) {
      return taxonomyError(
        409,
        "TAXONOMY_STALE",
        `sourceVersion ${sourceVersion} is older than the current version ${existing.sourceVersion}`
      );
    }
    if (sourceVersion === existing.sourceVersion) {
      if (existing.contentHash === contentHash) return { classification: existing, deduplicated: true };
      return taxonomyError(409, "TAXONOMY_CONFLICT", "same sourceVersion with different content");
    }
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.activityExternalClassification.update({
        where: { id: existing.id },
        data: {
          ...(jsonWrite(input.labelJson) !== undefined ? { labelJson: jsonWrite(input.labelJson) } : {}),
          sourceVersion,
          status: "ACTIVE",
          idempotencyKey: input.idempotencyKey,
          contentHash,
        },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.auditActorUserId ?? null,
          action: "activity_taxonomy.set",
          subjectType: "ActivityExternalClassification",
          subjectId: row.id,
          result: "SUCCESS",
          metadataJson: {
            activityId: input.activityId,
            taxonomySystem: input.taxonomySystem,
            taxonomyRef: input.taxonomyRef,
            sourceVersion,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      return row;
    });
    return { classification: updated, deduplicated: false };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.activityExternalClassification.create({
        data: {
          activityId: input.activityId,
          taxonomySystem: input.taxonomySystem,
          taxonomyRef: input.taxonomyRef,
          ...(jsonWrite(input.labelJson) !== undefined ? { labelJson: jsonWrite(input.labelJson) } : {}),
          sourceVersion,
          status: "ACTIVE",
          idempotencyKey: input.idempotencyKey,
          contentHash,
        },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.auditActorUserId ?? null,
          action: "activity_taxonomy.set",
          subjectType: "ActivityExternalClassification",
          subjectId: row.id,
          result: "SUCCESS",
          metadataJson: {
            activityId: input.activityId,
            taxonomySystem: input.taxonomySystem,
            taxonomyRef: input.taxonomyRef,
            sourceVersion,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      return row;
    });
    return { classification: created, deduplicated: false };
  } catch (error) {
    // 并发首登记唯一约束竞争：重读并转幂等/版本语义。
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      const winner = await prisma.activityExternalClassification.findUnique({
        where: {
          activityId_taxonomySystem_taxonomyRef: {
            activityId: input.activityId,
            taxonomySystem: input.taxonomySystem,
            taxonomyRef: input.taxonomyRef,
          },
        },
      });
      if (winner) {
        if (winner.sourceVersion === sourceVersion && winner.contentHash === contentHash) {
          return { classification: winner, deduplicated: true };
        }
        if (sourceVersion < winner.sourceVersion) {
          return taxonomyError(409, "TAXONOMY_STALE", `sourceVersion ${sourceVersion} is older than the current version ${winner.sourceVersion}`);
        }
        return taxonomyError(409, "TAXONOMY_CONFLICT", "classification was created concurrently");
      }
    }
    throw error;
  }
}

export async function withdrawActivityClassification(
  prisma: PrismaLike,
  input: {
    activityId: string;
    taxonomySystem: string;
    taxonomyRef: string;
    sourceVersion: number;
    idempotencyKey: string;
    auditActorUserId?: string | null;
  }
): Promise<{ classification: ActivityClassification; deduplicated: boolean } | TaxonomyError> {
  const withdrawHash = createHash("sha256")
    .update(stableStringify({ withdraw: true, ...input, auditActorUserId: undefined }))
    .digest("hex");

  const byKey = await prisma.activityExternalClassification.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (byKey) {
    if (byKey.contentHash !== withdrawHash) {
      return taxonomyError(409, "TAXONOMY_CONFLICT", "idempotencyKey was already used with different content");
    }
    return { classification: byKey, deduplicated: true };
  }

  const existing = await prisma.activityExternalClassification.findUnique({
    where: {
      activityId_taxonomySystem_taxonomyRef: {
        activityId: input.activityId,
        taxonomySystem: input.taxonomySystem,
        taxonomyRef: input.taxonomyRef,
      },
    },
  });
  if (!existing) return taxonomyError(404, "TAXONOMY_NOT_FOUND", "Classification not found");
  if (input.sourceVersion < existing.sourceVersion) {
    return taxonomyError(
      409,
      "TAXONOMY_STALE",
      `sourceVersion ${input.sourceVersion} is older than the current version ${existing.sourceVersion}`
    );
  }
  if (existing.status === "WITHDRAWN") {
    return { classification: existing, deduplicated: true };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.activityExternalClassification.update({
      where: { id: existing.id },
      data: {
        status: "WITHDRAWN",
        sourceVersion: input.sourceVersion,
        idempotencyKey: input.idempotencyKey,
        contentHash: withdrawHash,
      },
    });
    await tx.coreAuditLog.create({
      data: {
        actorUserId: input.auditActorUserId ?? null,
        action: "activity_taxonomy.withdraw",
        subjectType: "ActivityExternalClassification",
        subjectId: row.id,
        result: "SUCCESS",
        metadataJson: {
          activityId: input.activityId,
          taxonomySystem: input.taxonomySystem,
          taxonomyRef: input.taxonomyRef,
          sourceVersion: input.sourceVersion,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    return row;
  });
  return { classification: updated, deduplicated: false };
}

export async function listActivityClassifications(
  prisma: Pick<PrismaClient, "activityExternalClassification">,
  activityId: string,
  options: { includeWithdrawn?: boolean } = {}
): Promise<{ classifications: Array<Pick<ActivityClassification, "id" | "taxonomySystem" | "taxonomyRef" | "labelJson" | "sourceVersion" | "status">> }> {
  const rows = await prisma.activityExternalClassification.findMany({
    where: { activityId, ...(options.includeWithdrawn ? {} : { status: "ACTIVE" }) },
    orderBy: [{ taxonomySystem: "asc" }, { taxonomyRef: "asc" }],
    select: { id: true, taxonomySystem: true, taxonomyRef: true, labelJson: true, sourceVersion: true, status: true },
  });
  return { classifications: rows };
}
