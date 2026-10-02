/**
 * 源码级测试：通用 sourceRef 解析与 schema 契约（CP-TODO-252 / CP-FR-071）
 *
 * 覆盖（loadService 沙箱 + 内存 Prisma mock）：
 * - resolveSourceRef：person/institution 白名单投影（内部字段绝不泄漏）；
 *   activity_brief / record_summary 投影；合并链解析到最终目标；
 *   未知/停用/USER_FACING 系统一律 404；未知 objectType 400；对象缺失 404；
 *   多 Programme 隔离：institution 需本 Programme 的 ACTIVE 代表授权、activity 需已接入
 *   本 Programme、record 需归属本 Programme（个人记录不归任何渠道），person 为全局身份；
 *   contentHash 稳定且随内容变化；审计落库
 * - validateAgainstSourceSchema：未知 schemaRef / 非对象 / 白名单外字段 / 通过
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./_service-loader.mjs";

const sourceRefs = loadService("apps/passport-web/lib/server/source-ref-contracts.ts");

function matches(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return condition.every((sub) => matches(row, sub));
    if (key === "OR") return condition.some((sub) => matches(row, sub));
    if (condition !== null && typeof condition === "object") {
      if ("in" in condition) return condition.in.includes(row[key]);
      if ("lte" in condition) return row[key] != null && row[key] <= condition.lte;
      if ("lt" in condition) return row[key] != null && row[key] < condition.lt;
      if ("gte" in condition) return row[key] != null && row[key] >= condition.gte;
      if ("gt" in condition) return row[key] != null && row[key] > condition.gt;
      if ("not" in condition) return row[key] !== condition.not;
      if ("notIn" in condition) return !condition.notIn.includes(row[key]);
      if (row[key] === undefined) return matches(row, condition);
      return matches(row[key] ?? {}, condition);
    }
    return row[key] === condition;
  });
}

function table(initial = []) {
  const rows = [...initial];
  return {
    rows,
    findUnique: async ({ where }) => rows.find((row) => matches(row, where)) ?? null,
    findMany: async ({ where } = {}) => rows.filter((row) => matches(row, where)),
    create: async ({ data }) => {
      const row = { id: `row-${rows.length + 1}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
  };
}

function fake({ clients = [], persons = [], institutions = [], activities = [], records = [], representations = [], mappings = [] } = {}) {
  const db = {
    channelClient: table(clients),
    person: table(persons),
    institution: table(institutions),
    activity: table(activities),
    scopedRecord: table(records),
    institutionRepresentation: table(representations),
    sourceObjectMapping: table(mappings),
    coreAuditLog: table(),
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

const FS_SYSTEM = [{ id: "c1", key: "FSLAB", isActive: true, type: "MACHINE", programmeId: "prg-fs" }];

function baseFake() {
  return fake({
    clients: FS_SYSTEM,
    persons: [
      {
        id: "p1",
        slug: "ada-lovelace",
        displayName: "Ada Lovelace",
        displayNameEn: "Ada Lovelace",
        avatar: null,
        countryOrRegion: "UK",
        countryOrRegionEn: "United Kingdom",
        verificationStatus: "VERIFIED",
        bio: "私密 bio 不得外发",
        orcid: "0000-0002-XXXX",
        mergedIntoId: null,
      },
      { id: "p-old", displayName: "Old Name", mergedIntoId: "p1", slug: null, countryOrRegion: null, countryOrRegionEn: null, verificationStatus: "DRAFT" },
    ],
    institutions: [
      {
        id: "i1",
        slug: "analytical-engines-lab",
        name: "Analytical Engines Lab",
        nameEn: "Analytical Engines Lab",
        shortName: "AEL",
        shortNameEn: "AEL",
        orgType: "lab",
        website: "https://example.org",
        legalName: "私密法名不得外发",
        publicContactEmail: "secret@example.org",
      },
    ],
    activities: [
      { id: "a1", slug: "climate-hackathon", title: "Climate Hackathon", titleEn: "Climate Hackathon", status: "PUBLISHED", startTime: new Date("2026-11-01T09:00:00Z"), endTime: new Date("2026-11-02T18:00:00Z"), organizerUserId: "u-admin" },
    ],
    records: [{ id: "r1", recordType: "lab_note", title: "Inquiry draft", status: "ACTIVE", currentRevision: 3, programmeId: "prg-fs", payloadJson: { secret: "payload 不外发" } }],
    representations: [{ id: "rep-1", institutionId: "i1", programmeId: "prg-fs", status: "ACTIVE" }],
    mappings: [{ id: "map-1", activityId: "a1", programmeId: "prg-fs", applyStatus: "ACTIVE" }],
  });
}

test("resolveSourceRef returns whitelisted projections with stable content hashes", async () => {
  const db = baseFake();

  const person = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "person", objectId: "p1" });
  assert.equal("error" in person, false);
  assert.equal(person.schemaRef, "cp.person_identity/v1");
  assert.equal(person.locator, "/api/people/p1");
  assert.equal(person.projection.displayName, "Ada Lovelace");
  assert.equal(person.projection.verificationStatus, "VERIFIED");
  assert.equal(person.projection.bio, undefined, "bio 不在白名单");
  assert.equal(person.projection.orcid, undefined, "orcid 不在白名单");
  assert.match(person.contentHash, /^[a-f0-9]{64}$/);

  const institution = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "institution", objectId: "i1" });
  assert.equal(institution.schemaRef, "cp.institution_context/v1");
  assert.equal(institution.projection.shortName, "AEL");
  assert.equal(institution.projection.legalName, undefined, "法名不在白名单");
  assert.equal(institution.projection.publicContactEmail, undefined, "联系邮箱不在白名单");

  const activity = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "activity", objectId: "a1" });
  assert.equal(activity.schemaRef, "cp.activity_brief/v1");
  assert.equal(activity.locator, "/en/activities/climate-hackathon");
  assert.equal(activity.projection.title, "Climate Hackathon");
  assert.equal(activity.projection.organizerUserId, undefined, "组织者账号不在白名单");

  const record = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "record", objectId: "r1" });
  assert.equal(record.schemaRef, "cp.record_summary/v1");
  assert.equal(record.projection.currentRevision, 3);
  assert.equal(record.projection.payloadJson, undefined, "记录正文不在白名单");

  const same = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "person", objectId: "p1" });
  assert.equal(same.contentHash, person.contentHash, "内容哈希稳定（来源方可做对账快照）");
  assert.equal(db.coreAuditLog.rows.length, 5);
  assert.equal(db.coreAuditLog.rows[0].action, "source_ref.resolve");
});

test("resolveSourceRef resolves merge chains to the final target", async () => {
  const db = baseFake();
  const resolved = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "person", objectId: "p-old" });
  assert.equal("error" in resolved, false);
  assert.equal(resolved.projection.id, "p1", "旧 id 解析到合并目标");
  assert.equal(resolved.locator, "/api/people/p1");
});

test("resolveSourceRef fails closed for unknown systems, types and objects", async () => {
  const db = baseFake();
  const unknownSystem = await sourceRefs.resolveSourceRef(db, { system: "NOPE", objectType: "person", objectId: "p1" });
  assert.equal(unknownSystem.status, 404);
  assert.equal(unknownSystem.code, "SOURCE_REF_NOT_FOUND");

  db.channelClient.rows.push({ id: "c2", key: "OFF", isActive: false, type: "MACHINE" });
  const inactive = await sourceRefs.resolveSourceRef(db, { system: "OFF", objectType: "person", objectId: "p1" });
  assert.equal(inactive.status, 404, "停用系统不泄漏");

  db.channelClient.rows.push({ id: "c3", key: "UFC", isActive: true, type: "USER_FACING" });
  const userFacing = await sourceRefs.resolveSourceRef(db, { system: "UFC", objectType: "person", objectId: "p1" });
  assert.equal(userFacing.status, 404, "USER_FACING 不可作来源系统");

  const badType = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "spaceship", objectId: "x" });
  assert.equal(badType.status, 400);
  assert.equal(badType.code, "SOURCE_SCHEMA_UNKNOWN");

  const missing = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "person", objectId: "ghost" });
  assert.equal(missing.status, 404);
});

test("resolveSourceRef scopes objects to the source system's own programme", async () => {
  const db = baseFake();

  // 别的 Programme 的机构：只有对方名下的代表授权，本 Programme 读不到。
  db.institution.rows.push({ id: "i-foreign", name: "Foreign Lab" });
  db.institutionRepresentation.rows.push({ id: "rep-f", institutionId: "i-foreign", programmeId: "prg-other", status: "ACTIVE" });
  const foreignInstitution = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "institution", objectId: "i-foreign" });
  assert.equal(foreignInstitution.status, 404);
  assert.equal(foreignInstitution.code, "SOURCE_REF_NOT_FOUND", "跨 Programme 与不存在同形，不确认对方 id 存在");

  db.institution.rows.push({ id: "i-revoked", name: "Revoked Lab" });
  db.institutionRepresentation.rows.push({ id: "rep-r", institutionId: "i-revoked", programmeId: "prg-fs", status: "REVOKED" });
  const revoked = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "institution", objectId: "i-revoked" });
  assert.equal(revoked.status, 404, "代表授权撤销后不再可见");

  db.activity.rows.push({ id: "a-foreign", title: "Foreign Activity" });
  db.sourceObjectMapping.rows.push({ id: "map-f", activityId: "a-foreign", programmeId: "prg-other", applyStatus: "ACTIVE" });
  const foreignActivity = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "activity", objectId: "a-foreign" });
  assert.equal(foreignActivity.status, 404);

  db.activity.rows.push({ id: "a-plain", title: "Unbound Activity" });
  const unmapped = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "activity", objectId: "a-plain" });
  assert.equal(unmapped.status, 404, "未接入映射的活动不属于任何 Programme");

  db.scopedRecord.rows.push({ id: "r-other", recordType: "lab_note", programmeId: "prg-other" });
  const otherRecord = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "record", objectId: "r-other" });
  assert.equal(otherRecord.status, 404);

  db.scopedRecord.rows.push({ id: "r-personal", recordType: "lab_note", programmeId: null });
  const personal = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "record", objectId: "r-personal" });
  assert.equal(personal.status, 404, "个人记录不归任何渠道");

  // person 是跨 Programme 的全局身份，只给公开投影，不按租户切分。
  const person = await sourceRefs.resolveSourceRef(db, { system: "FSLAB", objectType: "person", objectId: "p1" });
  assert.equal("error" in person, false);
  assert.equal(person.projection.bio, undefined);
});

test("hashSourceProjection is content sensitive and key order independent", async () => {
  const a = sourceRefs.hashSourceProjection({ name: "Lab", id: "1" });
  const b = sourceRefs.hashSourceProjection({ id: "1", name: "Lab" });
  const c = sourceRefs.hashSourceProjection({ id: "1", name: "Other" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("validateAgainstSourceSchema enforces CP whitelist schemas only", async () => {
  assert.equal(sourceRefs.validateAgainstSourceSchema("cp.person_identity/v1", { displayName: "Ada" }), null);
  const offWhitelist = sourceRefs.validateAgainstSourceSchema("cp.person_identity/v1", { displayName: "Ada", bio: "nope" });
  assert.equal(offWhitelist.path, "bio");
  const unknown = sourceRefs.validateAgainstSourceSchema("fs.inquiry/v9", { title: "x" });
  assert.equal(unknown.path, "schemaRef", "CP 不理解 programme 专有 schema");
  const nonObject = sourceRefs.validateAgainstSourceSchema("cp.record_summary/v1", [1, 2]);
  assert.equal(nonObject.path, "$");
});
