/**
 * CP-TODO-252: generic external references (sourceRef) with versioned schema
 * contracts and field whitelists (CP-FR-071).
 *
 * 原则：
 * - 登记即契约：sourceRef.system 必须是已登记且启用的 MACHINE ChannelClient key；
 *   未知/停用系统一律 404，不泄漏登记目录。
 * - 多 Programme 隔离：可见范围取自该来源系统自己的 programmeId（调用方无法另传）。
 *   institution 需在该 Programme 有 ACTIVE 代表授权、activity 需已接入该 Programme、
 *   record 需属于该 Programme；person 是全局身份，只给公开投影，不按租户切分。
 * - schema 版本与白名单：每类对象只暴露固定 schemaRef 的白名单投影
 *   （person_identity / institution_context / activity_brief / record_summary），
 *   内部字段（联系方式、法名、ORCID、bio 等）绝不进入投影。
 * - 不执行专有规则：CP 只解析引用、给出定位符与内容哈希；业务关系图由 programme
 *   在自己的系统中维护。合并链（mergedIntoId）解析到最终目标。
 */

import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export type SourceRefError = { error: string; status: number; code: string };

export function sourceRefError(status: number, code: string, error: string): SourceRefError {
  return { error, status, code };
}

type PrismaLike = Pick<
  PrismaClient,
  "channelClient" | "person" | "institution" | "activity" | "scopedRecord" | "coreAuditLog" | "institutionRepresentation" | "sourceObjectMapping"
> & { $transaction: PrismaClient["$transaction"] };

export const SOURCE_REF_SCHEMA_REFS = {
  person: "cp.person_identity/v1",
  institution: "cp.institution_context/v1",
  activity: "cp.activity_brief/v1",
  record: "cp.record_summary/v1",
} as const;

const PERSON_IDENTITY_FIELDS = [
  "id",
  "slug",
  "displayName",
  "displayNameEn",
  "avatar",
  "countryOrRegion",
  "countryOrRegionEn",
  "verificationStatus",
] as const;

const INSTITUTION_CONTEXT_FIELDS = [
  "id",
  "slug",
  "name",
  "nameEn",
  "shortName",
  "shortNameEn",
  "orgType",
  "website",
] as const;

const ACTIVITY_BRIEF_FIELDS = ["id", "slug", "title", "titleEn", "status", "startTime", "endTime"] as const;
const RECORD_SUMMARY_FIELDS = ["id", "recordType", "title", "status", "currentRevision"] as const;

function whitelist<T extends Record<string, unknown>>(row: T, fields: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]]));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function hashSourceProjection(projection: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(projection)).digest("hex");
}

/** 合并链解析：沿 mergedIntoId 走到最终目标（带步数护栏）。 */
async function resolveMergeChain<T extends { mergedIntoId: string | null }>(
  load: (id: string) => Promise<T | null>,
  id: string,
  limit = 10
): Promise<T | null> {
  let current = await load(id);
  let steps = 0;
  while (current?.mergedIntoId && steps < limit) {
    current = await load(current.mergedIntoId);
    steps += 1;
  }
  return current;
}

export type SourceRefResolution = {
  system: string;
  objectType: string;
  objectId: string;
  schemaRef: string;
  locator: string;
  contentHash: string;
  projection: Record<string, unknown>;
};

export async function resolveSourceRef(
  prisma: PrismaLike,
  input: { system: string; objectType: string; objectId: string }
): Promise<SourceRefResolution | SourceRefError> {
  const client = await prisma.channelClient.findUnique({ where: { key: input.system } });
  if (!client || !client.isActive || client.type !== "MACHINE") {
    return sourceRefError(404, "SOURCE_REF_NOT_FOUND", "Unknown or inactive source system");
  }

  // 可见范围由这个来源系统自己的 Programme 决定，不采信任何另传的程序 id：
  // 跨 Programme 的引用一律 404，与"对象不存在"同形，不确认对方的 id 存在。
  const programmeId = client.programmeId;

  let schemaRef: string;
  let locator: string;
  let projection: Record<string, unknown>;

  if (input.objectType === "person") {
    // Person 是跨 Programme 的全局身份，投影只有公开档案字段（无联系方式、无 bio/ORCID），
    // 因此不按 Programme 切分——切分反而会让人以为同一个人按租户有不同身份。
    const person = await resolveMergeChain(
      (id) => prisma.person.findUnique({ where: { id } }),
      input.objectId
    );
    if (!person) return sourceRefError(404, "SOURCE_REF_NOT_FOUND", "Referenced person not found");
    schemaRef = SOURCE_REF_SCHEMA_REFS.person;
    locator = `/api/people/${person.id}`;
    projection = whitelist(person as Record<string, unknown>, PERSON_IDENTITY_FIELDS);
  } else if (input.objectType === "institution") {
    const institution = await resolveMergeChain(
      (id) => prisma.institution.findUnique({ where: { id } }),
      input.objectId
    );
    if (!institution) return sourceRefError(404, "SOURCE_REF_NOT_FOUND", "Referenced institution not found");
    // 机构与 Programme 的边只有代表授权（InstitutionRepresentation）这一条。
    const representations = await prisma.institutionRepresentation.findMany({
      where: { institutionId: institution.id, programmeId, status: "ACTIVE" },
      select: { id: true },
    });
    if (representations.length === 0) {
      return sourceRefError(404, "SOURCE_REF_NOT_FOUND", "Referenced institution not found");
    }
    schemaRef = SOURCE_REF_SCHEMA_REFS.institution;
    locator = `/api/institutions/${institution.id}`;
    projection = whitelist(institution as Record<string, unknown>, INSTITUTION_CONTEXT_FIELDS);
  } else if (input.objectType === "activity") {
    const activity = await prisma.activity.findUnique({ where: { id: input.objectId } });
    if (!activity) return sourceRefError(404, "SOURCE_REF_NOT_FOUND", "Referenced activity not found");
    const mappings = await prisma.sourceObjectMapping.findMany({
      where: { activityId: activity.id, programmeId, applyStatus: "ACTIVE" },
      select: { id: true },
    });
    if (mappings.length === 0) {
      return sourceRefError(404, "SOURCE_REF_NOT_FOUND", "Referenced activity not found");
    }
    schemaRef = SOURCE_REF_SCHEMA_REFS.activity;
    locator = activity.slug ? `/en/activities/${activity.slug}` : `/api/activities/${activity.id}`;
    projection = whitelist(activity as Record<string, unknown>, ACTIVITY_BRIEF_FIELDS);
  } else if (input.objectType === "record") {
    const record = await prisma.scopedRecord.findUnique({ where: { id: input.objectId } });
    if (!record) return sourceRefError(404, "SOURCE_REF_NOT_FOUND", "Referenced record not found");
    // 记录要么属于该 Programme，要么是个人记录（programmeId 为 null）——个人记录不属于
    // 任何渠道，机器 key 一律读不到。
    if (record.programmeId !== programmeId) {
      return sourceRefError(404, "SOURCE_REF_NOT_FOUND", "Referenced record not found");
    }
    schemaRef = SOURCE_REF_SCHEMA_REFS.record;
    locator = `/api/records/${record.id}`;
    projection = whitelist(record as Record<string, unknown>, RECORD_SUMMARY_FIELDS);
  } else {
    return sourceRefError(400, "SOURCE_SCHEMA_UNKNOWN", `objectType must be one of: person, institution, activity, record`);
  }

  const contentHash = hashSourceProjection(projection);
  await prisma.$transaction(async (tx) => {
    await tx.coreAuditLog.create({
      data: {
        actorUserId: null,
        action: "source_ref.resolve",
        subjectType: "SourceRef",
        subjectId: `${input.system}:${input.objectType}:${input.objectId}`,
        result: "SUCCESS",
        metadataJson: { system: input.system, objectType: input.objectType, objectId: input.objectId, schemaRef, contentHash },
      },
    });
  });

  return {
    system: input.system,
    objectType: input.objectType,
    objectId: input.objectId,
    schemaRef,
    locator,
    contentHash,
    projection,
  };
}

/**
 * 按 schemaRef 校验投影（FS 等来源方接入示例的校验面）。
 * 返回 null 表示通过；否则返回首条问题。CP 只校验自有白名单 schema，
 * 不理解 programme 专有 schema。
 */
export function validateAgainstSourceSchema(
  schemaRef: string,
  payload: unknown
): { path: string; message: string } | null {
  const allowedFields: Record<string, readonly string[]> = {
    [SOURCE_REF_SCHEMA_REFS.person]: PERSON_IDENTITY_FIELDS,
    [SOURCE_REF_SCHEMA_REFS.institution]: INSTITUTION_CONTEXT_FIELDS,
    [SOURCE_REF_SCHEMA_REFS.activity]: ACTIVITY_BRIEF_FIELDS,
    [SOURCE_REF_SCHEMA_REFS.record]: RECORD_SUMMARY_FIELDS,
  };
  const fields = allowedFields[schemaRef];
  if (!fields) return { path: "schemaRef", message: `Unknown CP schemaRef: ${schemaRef}` };
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { path: "$", message: "Projection must be an object" };
  }
  const record = payload as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!fields.includes(key)) return { path: key, message: `Field ${key} is not in ${schemaRef} whitelist` };
  }
  return null;
}
