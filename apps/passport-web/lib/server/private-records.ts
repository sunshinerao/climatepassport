import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveScopedAccess } from "./programme-scope";

/**
 * CP-TODO-247：通用私密记录 + 不可变修订 + 对象级协作授权（CP-FR-057/071）。
 *
 * 原则：
 * - 记录默认 Private：仅所有者、有效对象授权（ObjectAuthorization，限定对象/用途/有效期）
 *   或 Programme 范围成员可读/写；匿名与越权一律拒绝（CP-FR-057）。
 * - 更新走 compare-and-set（expectedRevision 不匹配返回 409，绝不覆盖新版本），
 *   每次成功更新落一条不可变 RecordRevision（CP-FR-057 冲突不覆盖）。
 * - 个人记录（无 programmeId）的分享经 ObjectAuthorization.programmeId = null 表达；
 *   Programme 记录的授权挂在记录所属 Programme 下（ADR：对象级分享为 CP 权威）。
 * - 撤回（WITHDRAWN）后不可再更新；非所有者不再可见（404，不泄漏存在性）。
 * - 关键写入与审计同一事务提交（CP-AUD-005）。
 */

export type RecordScopedAction = "read" | "write" | "manage";

export type PrivateRecordError = { error: string; status: number; code: string };

type PrismaLike = Pick<PrismaClient,
  | "scopedRecord"
  | "recordRevision"
  | "objectAuthorization"
  | "programme"
  | "edition"
  | "accessMembership"
  | "institutionRepresentation"
  | "sourceObjectMapping"
  | "user"
  | "coreAuditLog"> & {
    $transaction: PrismaClient["$transaction"];
  };

const ACTION_RANK: Record<string, number> = { READ: 1, WRITE: 2, MANAGE: 3 };
const RECORD_OBJECT_TYPE = "scoped_record";

function recordError(error: string, status: number, code: string): PrivateRecordError {
  return { error, status, code };
}

function activeWindowConditions(now: Date) {
  return {
    isActive: true,
    revokedAt: null,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    ],
  };
}

function grantCovers(granted: string, requested: RecordScopedAction) {
  const grantedRank = ACTION_RANK[granted];
  return grantedRank !== undefined && grantedRank >= ACTION_RANK[requested.toUpperCase()];
}

export type RecordAccessResolution =
  | { granted: true; via: "owner" | "object_authorization" | "membership" }
  | { granted: false };

/** 记录访问判定：所有者 > 对象授权 > Programme 范围成员；默认拒绝。 */
export async function resolveRecordAccess(
  prisma: PrismaLike,
  record: { id: string; ownerUserId: string | null; programmeId: string | null },
  actorUserId: string | null,
  action: RecordScopedAction,
): Promise<RecordAccessResolution> {
  if (!actorUserId) return { granted: false };
  if (record.ownerUserId && record.ownerUserId === actorUserId) {
    return { granted: true, via: "owner" };
  }

  const now = new Date();
  const grants = await prisma.objectAuthorization.findMany({
    where: {
      subjectUserId: actorUserId,
      objectType: RECORD_OBJECT_TYPE,
      objectId: record.id,
      programmeId: record.programmeId ?? null,
      editionId: null,
      ...activeWindowConditions(now),
    },
    select: { action: true },
  });
  // 同一主体可能持有多条授权（如先 READ 后 WRITE），取最高权限判定。
  if (grants.some((grant) => grantCovers(grant.action, action))) {
    return { granted: true, via: "object_authorization" };
  }

  if (record.programmeId) {
    const decision = await resolveScopedAccess(
      prisma,
      { id: actorUserId },
      { programmeId: record.programmeId },
      action,
      null,
    );
    if (decision.allowed) return { granted: true, via: "membership" };
  }

  return { granted: false };
}

/** 创建私密记录：所有者即创建者；programmeId 可选（个人记录为 null）。 */
export async function createScopedRecord(
  prisma: PrismaLike,
  input: {
    actorUserId: string;
    recordType: string;
    title: string;
    payloadJson: Record<string, unknown>;
    programmeId?: string | null;
  },
): Promise<{ recordId: string; revision: number } | PrivateRecordError> {
  if (input.programmeId) {
    const programme = await prisma.programme.findFirst({
      where: { id: input.programmeId, isActive: true },
      select: { id: true },
    });
    if (!programme) return recordError("Programme not found or inactive.", 404, "RECORD_NOT_FOUND");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx.scopedRecord.create({
        data: {
          ownerUserId: input.actorUserId,
          createdById: input.actorUserId,
          recordType: input.recordType,
          title: input.title,
          payloadJson: input.payloadJson as Prisma.InputJsonValue,
          programmeId: input.programmeId ?? null,
          status: "ACTIVE",
          currentRevision: 1,
        },
        select: { id: true },
      });
      await tx.recordRevision.create({
        data: {
          recordId: record.id,
          revision: 1,
          payloadJson: input.payloadJson as Prisma.InputJsonValue,
          createdById: input.actorUserId,
        },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "record.create",
          subjectType: RECORD_OBJECT_TYPE,
          subjectId: record.id,
          result: "created",
          metadataJson: { recordType: input.recordType, programmeId: input.programmeId ?? null },
        },
      });
      return { recordId: record.id, revision: 1 };
    });
  } catch (error) {
    console.error("scoped record create failed:", error);
    return recordError("Record create failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 读取单条记录；撤回记录仅所有者可见，其余按不存在处理。 */
export async function readScopedRecord(
  prisma: PrismaLike,
  input: { recordId: string; actorUserId: string | null },
): Promise<{ record: Record<string, unknown> } | PrivateRecordError> {
  const record = await prisma.scopedRecord.findUnique({ where: { id: input.recordId } });
  if (!record) return recordError("Record not found.", 404, "RECORD_NOT_FOUND");
  if (record.status !== "ACTIVE" && record.ownerUserId !== input.actorUserId) {
    return recordError("Record not found.", 404, "RECORD_NOT_FOUND");
  }

  const access = await resolveRecordAccess(prisma, record, input.actorUserId, "read");
  if (!access.granted) return recordError("Forbidden", 403, "RECORD_ACCESS_DENIED");
  return { record: record as unknown as Record<string, unknown> };
}

/** 列出当前账号可见的记录：所有 + 被授权 + Programme 范围内记录。 */
export async function listScopedRecords(
  prisma: PrismaLike,
  input: { actorUserId: string; recordType?: string; programmeId?: string },
): Promise<{ records: Array<Record<string, unknown>> }> {
  const now = new Date();
  const grants = await prisma.objectAuthorization.findMany({
    where: {
      subjectUserId: input.actorUserId,
      objectType: RECORD_OBJECT_TYPE,
      ...activeWindowConditions(now),
    },
    select: { objectId: true },
  });
  const memberships = await prisma.accessMembership.findMany({
    where: { userId: input.actorUserId, ...activeWindowConditions(now) },
    select: { programmeId: true },
  });
  const programmeIds = [...new Set(memberships.map((membership) => membership.programmeId))];

  const records = await prisma.scopedRecord.findMany({
    where: {
      status: "ACTIVE",
      ...(input.recordType ? { recordType: input.recordType } : {}),
      ...(input.programmeId ? { programmeId: input.programmeId } : {}),
      OR: [
        { ownerUserId: input.actorUserId },
        { id: { in: grants.map((grant) => grant.objectId) } },
        { programmeId: { in: programmeIds } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return { records: records as unknown as Array<Record<string, unknown>> };
}

/** compare-and-set 更新：expectedRevision 不匹配返回 409；每次成功更新追加不可变修订。 */
export async function updateScopedRecord(
  prisma: PrismaLike,
  input: {
    recordId: string;
    actorUserId: string;
    expectedRevision: number;
    payloadJson: Record<string, unknown>;
  },
): Promise<{ recordId: string; revision: number } | PrivateRecordError> {
  const record = await prisma.scopedRecord.findUnique({
    where: { id: input.recordId },
    select: { id: true, ownerUserId: true, programmeId: true, status: true, currentRevision: true },
  });
  if (!record) return recordError("Record not found.", 404, "RECORD_NOT_FOUND");
  if (record.status !== "ACTIVE") return recordError("Record is withdrawn.", 409, "RECORD_WITHDRAWN");

  const access = await resolveRecordAccess(prisma, record, input.actorUserId, "write");
  if (!access.granted) return recordError("Forbidden", 403, "RECORD_ACCESS_DENIED");

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.scopedRecord.updateMany({
        where: { id: record.id, currentRevision: input.expectedRevision, status: "ACTIVE" },
        data: {
          payloadJson: input.payloadJson as Prisma.InputJsonValue,
          currentRevision: input.expectedRevision + 1,
        },
      });
      if (updated.count !== 1) {
        return recordError("Record revision conflict; read the latest revision and retry.", 409, "RECORD_REVISION_CONFLICT");
      }
      await tx.recordRevision.create({
        data: {
          recordId: record.id,
          revision: input.expectedRevision + 1,
          payloadJson: input.payloadJson as Prisma.InputJsonValue,
          createdById: input.actorUserId,
        },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "record.update",
          subjectType: RECORD_OBJECT_TYPE,
          subjectId: record.id,
          result: "updated",
          metadataJson: { fromRevision: input.expectedRevision, toRevision: input.expectedRevision + 1 },
        },
      });
      return { recordId: record.id, revision: input.expectedRevision + 1 };
    });
  } catch (error) {
    console.error("scoped record update failed:", error);
    return recordError("Record update failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 修订历史（只追加，旧版本始终可查）。 */
export async function listRecordRevisions(
  prisma: PrismaLike,
  input: { recordId: string; actorUserId: string | null },
): Promise<{ revisions: Array<Record<string, unknown>> } | PrivateRecordError> {
  const record = await prisma.scopedRecord.findUnique({
    where: { id: input.recordId },
    select: { id: true, ownerUserId: true, programmeId: true, status: true },
  });
  if (!record) return recordError("Record not found.", 404, "RECORD_NOT_FOUND");
  const access = await resolveRecordAccess(prisma, record, input.actorUserId, "read");
  if (!access.granted) return recordError("Forbidden", 403, "RECORD_ACCESS_DENIED");

  const revisions = await prisma.recordRevision.findMany({
    where: { recordId: record.id },
    orderBy: { revision: "asc" },
  });
  return { revisions: revisions as unknown as Array<Record<string, unknown>> };
}

/** 对象级协作授权：仅记录所有者或 Programme manage 可授予；撤权立即生效。 */
export async function grantRecordAccess(
  prisma: PrismaLike,
  input: {
    recordId: string;
    actorUserId: string;
    subjectUserId: string;
    action: "READ" | "WRITE";
    purpose?: string | null;
    validFrom?: Date | null;
    validUntil?: Date | null;
  },
): Promise<{ grantId: string } | PrivateRecordError> {
  const record = await prisma.scopedRecord.findUnique({
    where: { id: input.recordId },
    select: { id: true, ownerUserId: true, programmeId: true, status: true },
  });
  if (!record) return recordError("Record not found.", 404, "RECORD_NOT_FOUND");
  if (input.validFrom && input.validUntil && input.validUntil <= input.validFrom) {
    return recordError("validUntil must be after validFrom.", 400, "INVALID_REQUEST");
  }

  const access = await resolveRecordAccess(prisma, record, input.actorUserId, "manage");
  if (!access.granted) return recordError("Forbidden", 403, "RECORD_ACCESS_DENIED");

  const subject = await prisma.user.findUnique({ where: { id: input.subjectUserId }, select: { id: true } });
  if (!subject) return recordError("Subject account not found.", 404, "RECORD_NOT_FOUND");

  try {
    return await prisma.$transaction(async (tx) => {
      const grant = await tx.objectAuthorization.create({
        data: {
          subjectUserId: input.subjectUserId,
          objectType: RECORD_OBJECT_TYPE,
          objectId: record.id,
          programmeId: record.programmeId,
          editionId: null,
          action: input.action,
          purpose: input.purpose ?? null,
          grantorUserId: input.actorUserId,
          validFrom: input.validFrom ?? null,
          validUntil: input.validUntil ?? null,
        },
        select: { id: true },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "record.grant",
          subjectType: RECORD_OBJECT_TYPE,
          subjectId: record.id,
          result: "granted",
          metadataJson: {
            grantId: grant.id,
            subjectUserId: input.subjectUserId,
            action: input.action,
            purpose: input.purpose ?? null,
          },
        },
      });
      return { grantId: grant.id };
    });
  } catch (error) {
    console.error("record grant failed:", error);
    return recordError("Grant failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 撤销协作授权：compare-and-set，立即生效。 */
export async function revokeRecordAccess(
  prisma: PrismaLike,
  input: { grantId: string; actorUserId: string },
): Promise<{ grantId: string } | PrivateRecordError> {
  const grant = await prisma.objectAuthorization.findUnique({
    where: { id: input.grantId },
    select: { id: true, objectId: true, objectType: true, grantorUserId: true },
  });
  if (!grant || grant.objectType !== RECORD_OBJECT_TYPE) {
    return recordError("Grant not found.", 404, "RECORD_NOT_FOUND");
  }
  const record = await prisma.scopedRecord.findUnique({
    where: { id: grant.objectId },
    select: { id: true, ownerUserId: true, programmeId: true },
  });
  if (!record) return recordError("Record not found.", 404, "RECORD_NOT_FOUND");

  const isGrantor = grant.grantorUserId === input.actorUserId;
  if (!isGrantor) {
    const access = await resolveRecordAccess(prisma, record, input.actorUserId, "manage");
    if (!access.granted) return recordError("Forbidden", 403, "RECORD_ACCESS_DENIED");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.objectAuthorization.updateMany({
        where: { id: grant.id, isActive: true },
        data: { isActive: false, revokedAt: new Date() },
      });
      if (updated.count !== 1) return recordError("Grant is no longer active.", 409, "INVALID_REQUEST");
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "record.revoke",
          subjectType: RECORD_OBJECT_TYPE,
          subjectId: record.id,
          result: "revoked",
          metadataJson: { grantId: grant.id },
        },
      });
      return { grantId: grant.id };
    });
  } catch (error) {
    console.error("record grant revoke failed:", error);
    return recordError("Revoke failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 撤回记录：所有者或 Programme manage；撤回后不可更新，非所有者不可见。 */
export async function withdrawScopedRecord(
  prisma: PrismaLike,
  input: { recordId: string; actorUserId: string },
): Promise<{ recordId: string } | PrivateRecordError> {
  const record = await prisma.scopedRecord.findUnique({
    where: { id: input.recordId },
    select: { id: true, ownerUserId: true, programmeId: true, status: true },
  });
  if (!record) return recordError("Record not found.", 404, "RECORD_NOT_FOUND");

  const access = await resolveRecordAccess(prisma, record, input.actorUserId, "manage");
  if (!access.granted) return recordError("Forbidden", 403, "RECORD_ACCESS_DENIED");

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.scopedRecord.updateMany({
        where: { id: record.id, status: "ACTIVE" },
        data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawnById: input.actorUserId },
      });
      if (updated.count !== 1) return recordError("Record is already withdrawn.", 409, "RECORD_WITHDRAWN");
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "record.withdraw",
          subjectType: RECORD_OBJECT_TYPE,
          subjectId: record.id,
          result: "withdrawn",
          metadataJson: {},
        },
      });
      return { recordId: record.id };
    });
  } catch (error) {
    console.error("scoped record withdraw failed:", error);
    return recordError("Withdraw failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}
