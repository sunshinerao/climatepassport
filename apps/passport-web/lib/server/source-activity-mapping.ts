import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { enqueueOutboundDispatch, findDispatchTargets } from "./reliable-dispatch";
import { hashProjectionJson } from "./publication-gateway";

/**
 * CP-TODO-245：正式活动来源映射执行层（CP-FR-053）。
 *
 * 原则：
 * - 并发首次接入只一条：来源三元组 (sourceSystem=登记客户端 key,
 *   sourceEditionRef, sourceObjectId) 唯一 + 每个 CP 活动最多一条 ACTIVE
 *   映射（部分唯一索引，数据库层兜底）；同幂等键同内容去重、异内容 409。
 * - 版本有序：sourceVersion 数字段感知比较，旧版本（含同版本异内容）
 *   一律 409 不覆盖（v3 后 v2 不能回退）；同版本同内容幂等。
 * - 字段权威白名单：来源只能写入映射登记的 authoritativeFields 白名单，
 *   且永远不能写 CP 入口/身份字段（status/visibility/slug/报名窗口/
 *   organizer 等）；CP 签到/参与状态是关系数据，来源结构上就不可写。
 * - CP 侧守卫：已映射活动 PATCH 触及来源权威字段 → 409；未映射活动行为
 *   完全不变（夏校冻结兼容）。
 * - 发布/取消：发布产生不可变版本投影（同 Publication 网关语义）；取消
 *   优先关闭入口（活动状态 CAS 置 CANCELLED + 撤回全部已发布版本），
 *   均在同一事务内向 dispatch:publications 订阅者扇出定位级事件。
 * - 关键写入与审计同一事务提交（CP-AUD-005）。
 */

export type SourceMappingError = { error: string; status: number; code: string };

type PrismaLike = Pick<PrismaClient,
  | "sourceObjectMapping"
  | "activity"
  | "publicationProjection"
  | "programme"
  | "edition"
  | "channelClient"
  | "outboundDispatch"
  | "coreAuditLog"> & {
    $transaction: PrismaClient["$transaction"];
  };

function mappingError(error: string, status: number, code: string): SourceMappingError {
  return { error, status, code };
}

export const ACTIVITY_PUBLICATION_OBJECT_TYPE = "activity";

/** CP 入口/身份字段：即使出现在来源白名单中也拒绝写（CP-FR-053）。 */
export const CP_CONTROLLED_ACTIVITY_FIELDS = new Set([
  "status", "visibility", "slug", "organizerUserId", "organizerName",
  "registrationOpenAt", "registrationCloseAt", "isFeatured", "isPinned",
  "isPrivate", "eventLayer", "hostType", "trackId", "createdByUserId",
  "type", "partnerIds", "requiresApproval", "applicantListVisibleToApplicants",
  "allowInterestWithoutApplication", "locationJson",
]);

/** 来源可写的 Activity 标量列（值经 whitelabel 校验后按此映射落库）。 */
const APPLYABLE_ACTIVITY_COLUMNS = new Set([
  "title", "titleEn", "subtitle", "subtitleEn", "summary", "summaryEn",
  "description", "descriptionEn", "startTime", "endTime", "timezone",
  "locationType", "onlineUrl", "coverImage", "posterImage", "mapUrl",
  "highlights", "highlightsEn", "language", "tags", "category", "capacity",
]);

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

export function hashBindContent(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(input))).digest("hex");
}

/** 数字段感知的来源版本比较：返回负数/0/正数（"2.10" > "2.9"）。 */
export function compareSourceVersions(left: string, right: string): number {
  const leftParts = left.split(/[.\-_]/).filter(Boolean);
  const rightParts = right.split(/[.\-_]/).filter(Boolean);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const a = leftParts[index];
    const b = rightParts[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const aNum = /^\d+$/.test(a) ? Number(a) : null;
    const bNum = /^\d+$/.test(b) ? Number(b) : null;
    if (aNum !== null && bNum !== null) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      if (a !== b) return a < b ? -1 : 1;
    }
  }
  return 0;
}

/** 活动当前 ACTIVE 来源映射（无映射 = 未接入来源的遗留活动，行为不变）。 */
export async function resolveActivitySourceMapping(
  prisma: Pick<PrismaClient, "sourceObjectMapping">,
  activityId: string,
): Promise<{ id: string; programmeId: string; authoritativeFields: string[]; sourceVersion: string | null } | null> {
  const mapping = await prisma.sourceObjectMapping.findFirst({
    where: { activityId, applyStatus: "ACTIVE" },
    select: { id: true, programmeId: true, authoritativeFieldsJson: true, sourceVersion: true },
    orderBy: { createdAt: "asc" },
  });
  if (!mapping) return null;
  const authoritativeFields = Array.isArray(mapping.authoritativeFieldsJson)
    ? (mapping.authoritativeFieldsJson as unknown[]).filter((field): field is string => typeof field === "string")
    : [];
  return { id: mapping.id, programmeId: mapping.programmeId, authoritativeFields, sourceVersion: mapping.sourceVersion };
}

/** CP 编辑守卫：返回请求字段中与来源权威白名单冲突的字段（空数组 = 可编辑）。 */
export async function listSourceOwnedFieldConflicts(
  prisma: Pick<PrismaClient, "sourceObjectMapping">,
  activityId: string,
  requestedFields: string[],
): Promise<string[]> {
  const mapping = await resolveActivitySourceMapping(prisma, activityId);
  if (!mapping) return [];
  const requested = new Set(requestedFields.map((field) => field.trim()).filter(Boolean));
  return mapping.authoritativeFields.filter((field) => requested.has(field));
}

/**
 * 报名/公开可见门：已映射活动必须有已发布投影且未取消；未映射活动放行
 * （由既有报名窗口逻辑继续约束，行为不变）。
 */
export async function assertActivityOpenForPublic(
  prisma: Pick<PrismaClient, "sourceObjectMapping" | "activity" | "publicationProjection">,
  activityId: string,
): Promise<{ open: true } | { open: false; status: number; error: string; code: string }> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, status: true } });
  if (!activity) return { open: false, status: 404, error: "Activity not found.", code: "INVALID_REQUEST" };
  const mapping = await resolveActivitySourceMapping(prisma, activityId);
  if (!mapping) return { open: true };
  if (activity.status === "CANCELLED") {
    return { open: false, status: 409, error: "Activity is cancelled.", code: "ACTIVITY_SOURCE_CANCELLED" };
  }
  const published = await prisma.publicationProjection.findFirst({
    where: { objectType: ACTIVITY_PUBLICATION_OBJECT_TYPE, objectId: activityId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!published) {
    return { open: false, status: 409, error: "Activity is not published by its source programme yet.", code: "ACTIVITY_SOURCE_NOT_PUBLISHED" };
  }
  return { open: true };
}

/** 首次接入：来源对象绑定 CP 活动（幂等 + 唯一 + 并发安全）。 */
export async function bindSourceActivity(
  prisma: PrismaLike,
  input: {
    clientKey: string;
    programmeId: string;
    editionId?: string | null;
    sourceEditionRef?: string | null;
    sourceObjectId: string;
    activityId: string;
    authoritativeFields: string[];
    idempotencyKey: string;
  },
): Promise<{ mappingId: string; deduplicated: boolean } | SourceMappingError> {
  const sourceEditionRef = input.sourceEditionRef?.trim() || "";
  const blockedFields = input.authoritativeFields.filter((field) => CP_CONTROLLED_ACTIVITY_FIELDS.has(field));
  if (blockedFields.length > 0) {
    return mappingError(`Fields are CP-controlled and cannot be source-owned: ${blockedFields.join(", ")}.`, 400, "INVALID_REQUEST");
  }
  const unknownFields = input.authoritativeFields.filter((field) => !APPLYABLE_ACTIVITY_COLUMNS.has(field));
  if (unknownFields.length > 0) {
    return mappingError(`Unknown activity fields: ${unknownFields.join(", ")}.`, 400, "INVALID_REQUEST");
  }

  const [programme, activity] = await Promise.all([
    prisma.programme.findFirst({ where: { id: input.programmeId, isActive: true }, select: { id: true } }),
    prisma.activity.findUnique({ where: { id: input.activityId }, select: { id: true } }),
  ]);
  if (!programme) return mappingError("Programme not found or inactive.", 404, "INVALID_REQUEST");
  if (!activity) return mappingError("Activity not found.", 404, "INVALID_REQUEST");
  if (input.editionId) {
    const edition = await prisma.edition.findFirst({
      where: { id: input.editionId, programmeId: input.programmeId, isActive: true, archivedAt: null },
      select: { id: true },
    });
    if (!edition) return mappingError("Edition does not belong to the programme or is archived.", 409, "INVALID_REQUEST");
  }

  const contentHash = hashBindContent({
    clientKey: input.clientKey,
    programmeId: input.programmeId,
    editionId: input.editionId ?? null,
    sourceEditionRef,
    sourceObjectId: input.sourceObjectId,
    activityId: input.activityId,
    authoritativeFields: [...input.authoritativeFields].sort(),
  });

  const existingByKey = await prisma.sourceObjectMapping.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, contentHash: true },
  });
  if (existingByKey) {
    if (existingByKey.contentHash === contentHash) return { mappingId: existingByKey.id, deduplicated: true };
    return mappingError("idempotencyKey was already used with different content.", 409, "SOURCE_MAPPING_CONFLICT");
  }

  const existingBySource = await prisma.sourceObjectMapping.findUnique({
    where: {
      sourceSystem_sourceEditionRef_sourceObjectId: {
        sourceSystem: input.clientKey,
        sourceEditionRef,
        sourceObjectId: input.sourceObjectId,
      },
    },
  });
  if (existingBySource) {
    if (existingBySource.activityId === input.activityId && existingBySource.applyStatus === "ACTIVE") {
      return { mappingId: existingBySource.id, deduplicated: true };
    }
    return mappingError("Source object is already bound to another activity.", 409, "SOURCE_MAPPING_CONFLICT");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const conflictingActivityMapping = await tx.sourceObjectMapping.findFirst({
        where: { activityId: input.activityId, applyStatus: "ACTIVE" },
        select: { id: true },
      });
      if (conflictingActivityMapping) {
        return mappingError("Activity is already bound to another source object.", 409, "SOURCE_MAPPING_CONFLICT");
      }
      const mapping = await tx.sourceObjectMapping.create({
        data: {
          programmeId: input.programmeId,
          editionId: input.editionId ?? null,
          sourceSystem: input.clientKey,
          sourceEditionRef,
          sourceObjectId: input.sourceObjectId,
          activityId: input.activityId,
          authoritativeFieldsJson: [...new Set(input.authoritativeFields)],
          applyStatus: "ACTIVE",
          idempotencyKey: input.idempotencyKey,
          contentHash,
        },
        select: { id: true },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: null,
          action: "source_mapping.bind",
          subjectType: ACTIVITY_PUBLICATION_OBJECT_TYPE,
          subjectId: input.activityId,
          result: "bound",
          metadataJson: {
            mappingId: mapping.id,
            sourceSystem: input.clientKey,
            sourceObjectId: input.sourceObjectId,
            sourceEditionRef,
            authoritativeFields: [...new Set(input.authoritativeFields)],
          },
        },
      });
      return { mappingId: mapping.id, deduplicated: false };
    });
  } catch (error) {
    // 并发首接入：唯一索引/部分唯一索引竞争失败 → 重读按幂等语义返回。
    const winner = await prisma.sourceObjectMapping.findFirst({
      where: {
        sourceSystem: input.clientKey,
        sourceEditionRef,
        sourceObjectId: input.sourceObjectId,
        applyStatus: "ACTIVE",
      },
      select: { id: true, activityId: true, contentHash: true },
    });
    if (winner && winner.activityId === input.activityId && winner.contentHash === contentHash) {
      return { mappingId: winner.id, deduplicated: true };
    }
    console.error("source activity bind failed:", error);
    return mappingError("Bind failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

function mappingLookup(input: { sourceObjectId: string; sourceEditionRef?: string | null }, clientKey: string) {
  return {
    sourceSystem: clientKey,
    sourceEditionRef: input.sourceEditionRef?.trim() || "",
    sourceObjectId: input.sourceObjectId,
    applyStatus: "ACTIVE" as const,
  };
}

/** 来源版本修订：白名单字段 + 版本序 + CAS；CP 入口字段永不落库。 */
export async function applySourceRevision(
  prisma: PrismaLike,
  input: {
    clientKey: string;
    sourceObjectId: string;
    sourceEditionRef?: string | null;
    sourceVersion: string;
    fields: Record<string, unknown>;
    idempotencyKey: string;
  },
): Promise<{ mappingId: string; applied: boolean } | SourceMappingError> {
  const mapping = await prisma.sourceObjectMapping.findFirst({
    where: mappingLookup(input, input.clientKey),
    select: { id: true, activityId: true, sourceVersion: true, authoritativeFieldsJson: true, receiptJson: true },
  });
  if (!mapping || !mapping.activityId) return mappingError("Source mapping not found.", 404, "SOURCE_MAPPING_NOT_FOUND");

  const whitelist = Array.isArray(mapping.authoritativeFieldsJson)
    ? (mapping.authoritativeFieldsJson as unknown[]).filter((field): field is string => typeof field === "string")
    : [];
  const requested = Object.keys(input.fields);
  const blocked = requested.filter((field) => CP_CONTROLLED_ACTIVITY_FIELDS.has(field));
  if (blocked.length > 0) {
    return mappingError(`Fields are CP-controlled and can never be source-written: ${blocked.join(", ")}.`, 400, "INVALID_REQUEST");
  }
  const offWhitelist = requested.filter((field) => !whitelist.includes(field));
  if (offWhitelist.length > 0) {
    return mappingError(`Fields are not in the mapping's authoritative whitelist: ${offWhitelist.join(", ")}.`, 400, "INVALID_REQUEST");
  }
  const unknown = requested.filter((field) => !APPLYABLE_ACTIVITY_COLUMNS.has(field));
  if (unknown.length > 0) {
    return mappingError(`Unknown activity fields: ${unknown.join(", ")}.`, 400, "INVALID_REQUEST");
  }

  const revisionHash = hashBindContent({ mappingId: mapping.id, sourceVersion: input.sourceVersion, fields: input.fields });
  const prior = mapping.receiptJson as { revisionHash?: string } | null;
  if (mapping.sourceVersion !== null) {
    const order = compareSourceVersions(input.sourceVersion, mapping.sourceVersion);
    if (order < 0) {
      return mappingError("A newer source version was already applied; older revisions are rejected.", 409, "SOURCE_MAPPING_STALE");
    }
    if (order === 0) {
      if (prior?.revisionHash === revisionHash) return { mappingId: mapping.id, applied: false };
      return mappingError("A different payload for the same source version already exists.", 409, "SOURCE_MAPPING_CONFLICT");
    }
  }

  const data: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(input.fields)) {
    data[field] = field === "startTime" || field === "endTime"
      ? (value ? new Date(value as string) : null)
      : value;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const cas = await tx.sourceObjectMapping.updateMany({
        where: { id: mapping.id, OR: [{ sourceVersion: mapping.sourceVersion }, { sourceVersion: null }] },
        data: { sourceVersion: input.sourceVersion, receiptJson: { revisionHash, appliedAt: new Date().toISOString() } },
      });
      if (cas.count !== 1) {
        return mappingError("Concurrent revision apply detected; read the latest source version and retry.", 409, "SOURCE_MAPPING_STALE");
      }
      await tx.activity.update({ where: { id: mapping.activityId! }, data: data as never });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: null,
          action: "source_mapping.apply",
          subjectType: ACTIVITY_PUBLICATION_OBJECT_TYPE,
          subjectId: mapping.activityId!,
          result: "applied",
          metadataJson: { mappingId: mapping.id, sourceVersion: input.sourceVersion, fields: requested },
        },
      });
      return { mappingId: mapping.id, applied: true };
    });
  } catch (error) {
    console.error("source revision apply failed:", error);
    return mappingError("Revision apply failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 来源发布：活动投影按版本发布（同 Publication 网关语义，机器路径）。 */
export async function publishSourceActivity(
  prisma: PrismaLike,
  input: {
    clientKey: string;
    sourceObjectId: string;
    sourceEditionRef?: string | null;
    sourceVersion: string;
    projectionJson: Record<string, unknown>;
    channel?: string | null;
    idempotencyKey: string;
  },
): Promise<{ publicationId: string; deduplicated: boolean } | SourceMappingError> {
  const mapping = await prisma.sourceObjectMapping.findFirst({
    where: mappingLookup(input, input.clientKey),
    select: { id: true, activityId: true, sourceVersion: true },
  });
  if (!mapping || !mapping.activityId) return mappingError("Source mapping not found.", 404, "SOURCE_MAPPING_NOT_FOUND");

  const versionNumber = Number.parseInt(input.sourceVersion, 10);
  if (!Number.isFinite(versionNumber) || versionNumber < 1 || String(versionNumber) !== input.sourceVersion) {
    return mappingError("sourceVersion must be a positive integer for publishing.", 400, "INVALID_REQUEST");
  }
  if (mapping.sourceVersion !== null && compareSourceVersions(input.sourceVersion, mapping.sourceVersion) < 0) {
    return mappingError("Cannot publish an older source version.", 409, "SOURCE_MAPPING_STALE");
  }

  const contentHash = hashProjectionJson(input.projectionJson);
  const existing = await prisma.publicationProjection.findUnique({
    where: {
      objectType_objectId_version: {
        objectType: ACTIVITY_PUBLICATION_OBJECT_TYPE,
        objectId: mapping.activityId,
        version: versionNumber,
      },
    },
  });
  if (existing) {
    if (existing.status === "WITHDRAWN") {
      return mappingError("This version was withdrawn and cannot be republished; publish a new version.", 409, "PUBLICATION_RESTORE_FORBIDDEN");
    }
    if (hashProjectionJson(existing.projectionJson as Record<string, unknown>) === contentHash) {
      return { publicationId: existing.id, deduplicated: true };
    }
    return mappingError("A different projection for this version is already published.", 409, "PUBLICATION_CONFLICT");
  }

  const targets = await findDispatchTargets(prisma, "dispatch:publications");

  try {
    return await prisma.$transaction(async (tx) => {
      const publication = await tx.publicationProjection.create({
        data: {
          objectType: ACTIVITY_PUBLICATION_OBJECT_TYPE,
          objectId: mapping.activityId!,
          version: versionNumber,
          projectionJson: input.projectionJson as Prisma.InputJsonValue,
          status: "PUBLISHED",
        },
        select: { id: true },
      });
      const publishedAt = new Date();
      for (const target of targets) {
        await enqueueOutboundDispatch(tx, {
          eventType: "publication.published",
          idempotencyKey: `publication:activity:${mapping.activityId}:${versionNumber}:published:${target.id}`,
          payload: {
            objectType: ACTIVITY_PUBLICATION_OBJECT_TYPE,
            objectId: mapping.activityId,
            version: versionNumber,
            channel: input.channel ?? null,
            status: "PUBLISHED",
            publishedAt: publishedAt.toISOString(),
            projectionHash: contentHash,
          },
          revision: versionNumber,
          channelClientId: target.id,
        });
      }
      await tx.coreAuditLog.create({
        data: {
          actorUserId: null,
          action: "source_mapping.publish",
          subjectType: ACTIVITY_PUBLICATION_OBJECT_TYPE,
          subjectId: mapping.activityId!,
          result: "published",
          metadataJson: { mappingId: mapping.id, sourceVersion: input.sourceVersion, publicationId: publication.id },
        },
      });
      return { publicationId: publication.id, deduplicated: false };
    });
  } catch (error) {
    console.error("source activity publish failed:", error);
    return mappingError("Publish failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 来源取消：优先关闭入口（活动 CANCELLED）+ 撤回全部已发布版本；幂等。 */
export async function cancelSourceActivity(
  prisma: PrismaLike,
  input: {
    clientKey: string;
    sourceObjectId: string;
    sourceEditionRef?: string | null;
    reason?: string | null;
    idempotencyKey: string;
  },
): Promise<{ activityId: string; withdrawnVersions: number[]; cancelled: boolean } | SourceMappingError> {
  const mapping = await prisma.sourceObjectMapping.findFirst({
    where: mappingLookup(input, input.clientKey),
    select: { id: true, activityId: true },
  });
  if (!mapping || !mapping.activityId) return mappingError("Source mapping not found.", 404, "SOURCE_MAPPING_NOT_FOUND");
  const activityId = mapping.activityId;

  const targets = await findDispatchTargets(prisma, "dispatch:publications");

  try {
    return await prisma.$transaction(async (tx) => {
      const published = await tx.publicationProjection.findMany({
        where: { objectType: ACTIVITY_PUBLICATION_OBJECT_TYPE, objectId: activityId, status: "PUBLISHED" },
        select: { id: true, version: true },
      });
      const withdrawnVersions: number[] = [];
      const now = new Date();
      for (const row of published) {
        const withdrawn = await tx.publicationProjection.updateMany({
          where: { id: row.id, status: "PUBLISHED" },
          data: { status: "WITHDRAWN", withdrawnAt: now },
        });
        if (withdrawn.count === 1) withdrawnVersions.push(row.version);
      }

      const current = await tx.activity.findUnique({ where: { id: activityId }, select: { status: true } });
      let cancelled = false;
      if (current && current.status !== "CANCELLED") {
        await tx.activity.update({ where: { id: activityId }, data: { status: "CANCELLED" } });
        cancelled = true;
      }

      for (const version of withdrawnVersions) {
        for (const target of targets) {
          await enqueueOutboundDispatch(tx, {
            eventType: "publication.withdrawn",
            idempotencyKey: `publication:activity:${activityId}:${version}:withdrawn:${target.id}`,
            payload: {
              objectType: ACTIVITY_PUBLICATION_OBJECT_TYPE,
              objectId: activityId,
              version,
              status: "WITHDRAWN",
              withdrawnAt: now.toISOString(),
            },
            revision: version,
            channelClientId: target.id,
          });
        }
      }
      if (cancelled) {
        for (const target of targets) {
          await enqueueOutboundDispatch(tx, {
            eventType: "activity.cancelled",
            idempotencyKey: `activity:${activityId}:cancelled:${target.id}:${input.idempotencyKey}`.slice(0, 180),
            payload: {
              objectType: ACTIVITY_PUBLICATION_OBJECT_TYPE,
              objectId: activityId,
              status: "CANCELLED",
              reason: input.reason ?? null,
              cancelledAt: now.toISOString(),
            },
            revision: 1,
            channelClientId: target.id,
          });
        }
      }
      await tx.coreAuditLog.create({
        data: {
          actorUserId: null,
          action: "source_mapping.cancel",
          subjectType: ACTIVITY_PUBLICATION_OBJECT_TYPE,
          subjectId: activityId,
          result: "cancelled",
          metadataJson: { mappingId: mapping.id, withdrawnVersions, reason: input.reason ?? null },
        },
      });
      return { activityId, withdrawnVersions, cancelled };
    });
  } catch (error) {
    console.error("source activity cancel failed:", error);
    return mappingError("Cancel failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 管理端列表。 */
export async function listActivityMappings(
  prisma: Pick<PrismaClient, "sourceObjectMapping">,
  input: { programmeId?: string; activityId?: string; take?: number },
): Promise<{ mappings: Array<Record<string, unknown>> }> {
  const mappings = await prisma.sourceObjectMapping.findMany({
    where: {
      ...(input.programmeId ? { programmeId: input.programmeId } : {}),
      ...(input.activityId ? { activityId: input.activityId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 100,
  });
  return { mappings: mappings as unknown as Array<Record<string, unknown>> };
}
