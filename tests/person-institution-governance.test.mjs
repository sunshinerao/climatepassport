/**
 * 源码级测试：Person 认领 / 机构代表权 / 合并别名 / 授权投影（CP-TODO-242 / CP-FR-051/052）
 *
 * 覆盖（vm/transpile + 内存 Prisma mock）：
 * - 合并链解析：链式跟随、不存在返回 null、成环返回 null
 * - 代表权判定：ACTIVE + 有效期窗口 + actionScope 覆盖（MANAGE 覆盖全部）；
 *   撤销、过期、未生效、actionScope 不覆盖一律拒绝；任职关系不参与判定
 * - 认领：仅 VERIFIED 且未关联账号可认领；账号已关联其他 Person 拒绝；合并源记录拒绝
 * - 授予：actionScope 非法 400；validUntil <= validFrom 400；合并源记录自动落到规范记录
 * - 撤销：compare-and-set，二次撤销 409
 * - 合并：引用迁移、别名并入、userId 转移、双账号冲突 409、自合并 400、同规范 409
 * - 关键写入与审计同事务（CP-AUD-005）：每次成功写入恰好一条审计
 * - 投影：institution_context / person_identity 白名单字段；未知 purpose 返回 null
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadGovernanceModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/person-institution-governance.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require: (name) => { throw new Error(`unexpected import: ${name}`); }, console };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const governance = loadGovernanceModule();

function matches(row, where) {
  return Object.entries(where ?? {}).every(([key, condition]) => {
    if (key === "AND") return condition.every((sub) => matches(row, sub));
    if (key === "OR") return condition.some((sub) => matches(row, sub));
    if (condition === null) return row[key] === null || row[key] === undefined;
    if (typeof condition === "object" && condition !== null) {
      if ("lte" in condition) return row[key] != null && row[key] <= condition.lte;
      if ("gt" in condition) return row[key] != null && row[key] > condition.gt;
    }
    return row[key] === condition;
  });
}

function makeFake(store) {
  const audits = [];
  const withAuditStore = { coreAuditLog: [], ...store };
  const delegateFor = (rows) => ({
    findUnique: async ({ where }) => rows.find((row) => matches(row, where)) ?? null,
    findFirst: async ({ where }) => rows.find((row) => matches(row, where)) ?? null,
    findMany: async ({ where } = {}) => rows.filter((row) => matches(row, where)),
    create: async ({ data }) => { const row = { id: `id-${rows.length + 1}`, ...data }; rows.push(row); return row; },
    update: async ({ where, data }) => {
      const row = rows.find((entry) => matches(entry, where));
      if (!row) throw new Error("record not found");
      for (const [key, value] of Object.entries(data)) row[key] = value;
      return row;
    },
    updateMany: async ({ where, data }) => {
      const targets = rows.filter((row) => matches(row, where));
      for (const row of targets) for (const [key, value] of Object.entries(data)) row[key] = value;
      return { count: targets.length };
    },
  });
  const fake = Object.fromEntries(Object.entries(withAuditStore).map(([model, rows]) => [model, delegateFor(rows)]));
  fake.coreAuditLog.create = async ({ data }) => { audits.push(data); return { id: `audit-${audits.length}` }; };
  fake.$transaction = async (callback) => callback(fake);
  fake.audits = audits;
  fake.$store = withAuditStore;
  return fake;
}

test("resolvePersonId / resolveInstitutionId follow merge chains and guard cycles", async () => {
  const fake = makeFake({
    person: [
      { id: "p-source", mergedIntoId: "p-mid" },
      { id: "p-mid", mergedIntoId: "p-canonical" },
      { id: "p-canonical", mergedIntoId: null },
      { id: "p-loop-a", mergedIntoId: "p-loop-b" },
      { id: "p-loop-b", mergedIntoId: "p-loop-a" },
    ],
    institution: [{ id: "i-canonical", mergedIntoId: null }],
  });
  assert.equal(await governance.resolvePersonId(fake, "p-source"), "p-canonical");
  assert.equal(await governance.resolvePersonId(fake, "p-canonical"), "p-canonical");
  assert.equal(await governance.resolvePersonId(fake, "p-loop-a"), null, "merge cycle must not hang");
  assert.equal(await governance.resolvePersonId(fake, "p-missing"), null);
  assert.equal(await governance.resolveInstitutionId(fake, "i-canonical"), "i-canonical");
});

test("resolveInstitutionRepresentation honors window, status, and action scope", async () => {
  const now = Date.now();
  const hour = 3_600_000;
  const fake = makeFake({
    institutionRepresentation: [
      { id: "r-read", institutionId: "i1", userId: "u1", status: "ACTIVE", revokedAt: null, validFrom: null, validUntil: null, actionScope: ["READ"] },
      { id: "r-manage", institutionId: "i1", userId: "u2", status: "ACTIVE", revokedAt: null, validFrom: null, validUntil: null, actionScope: ["MANAGE"] },
      { id: "r-revoked", institutionId: "i1", userId: "u3", status: "ACTIVE", revokedAt: new Date(now - hour), validFrom: null, validUntil: null, actionScope: ["MANAGE"] },
      { id: "r-expired", institutionId: "i1", userId: "u4", status: "ACTIVE", revokedAt: null, validFrom: null, validUntil: new Date(now - hour), actionScope: ["MANAGE"] },
      { id: "r-future", institutionId: "i1", userId: "u5", status: "ACTIVE", revokedAt: null, validFrom: new Date(now + hour), validUntil: null, actionScope: ["MANAGE"] },
    ],
  });

  const readDecision = await governance.resolveInstitutionRepresentation(fake, { userId: "u1", institutionId: "i1", action: "read" });
  assert.equal(readDecision.granted, true);
  assert.equal(readDecision.representationId, "r-read");
  assert.equal((await governance.resolveInstitutionRepresentation(fake, { userId: "u1", institutionId: "i1", action: "write" })).granted, false, "READ grant must not cover write");
  const manageDecision = await governance.resolveInstitutionRepresentation(fake, { userId: "u2", institutionId: "i1", action: "write" });
  assert.equal(manageDecision.granted, true, "MANAGE covers every action");
  assert.equal(manageDecision.representationId, "r-manage");
  for (const userId of ["u3", "u4", "u5", "u9"]) {
    assert.equal((await governance.resolveInstitutionRepresentation(fake, { userId, institutionId: "i1", action: "read" })).granted, false);
  }
});

test("claimPersonForUser links only verified, unclaimed persons and audits in-transaction", async () => {
  const fake = makeFake({
    person: [
      { id: "p-verified", userId: null, verificationStatus: "VERIFIED", mergedIntoId: null },
      { id: "p-draft", userId: null, verificationStatus: "DRAFT", mergedIntoId: null },
      { id: "p-claimed", userId: "u-other", verificationStatus: "VERIFIED", mergedIntoId: null },
      { id: "p-merged", userId: null, verificationStatus: "VERIFIED", mergedIntoId: "p-verified" },
    ],
    user: [{ id: "u1" }, { id: "u-other" }, { id: "u-taken" }],
  });
  // u-taken already owns a person record:
  fake.$store.person.push({ id: "p-taken-owner", userId: "u-taken", verificationStatus: "VERIFIED", mergedIntoId: null });

  for (const [personId, userId, message] of [
    ["p-draft", "u1", "Only verified person records can be claimed."],
    ["p-claimed", "u1", "Person is already linked to an account."],
    ["p-merged", "u1", "Person record was merged; claim the canonical record instead."],
    ["p-verified", "u-taken", "Account is already linked to another person record."],
    ["p-missing", "u1", "Person not found."],
  ]) {
    const result = await governance.claimPersonForUser(fake, { personId, userId, actorUserId: "u1" });
    assert.equal(result.error, message, `${personId}/${userId}`);
    assert.equal(result.status, personId === "p-missing" ? 404 : 409);
  }

  const ok = await governance.claimPersonForUser(fake, { personId: "p-verified", userId: "u1", actorUserId: "u1" });
  assert.equal(ok.personId, "p-verified");
  assert.equal(ok.userId, "u1");
  assert.equal(fake.audits.length, 1);
  assert.equal(fake.audits[0].action, "person.claim");
});

test("grantInstitutionRepresentation validates scope, resolves merge chain, and audits", async () => {
  const base = {
    institution: [{ id: "i-canonical", mergedIntoId: null }, { id: "i-source", mergedIntoId: "i-canonical" }],
    user: [{ id: "u1" }],
    programme: [{ id: "p1", isActive: true }],
    edition: [{ id: "e1", programmeId: "p1", isActive: true, archivedAt: null }],
    institutionRepresentation: [],
  };

  const invalid = await governance.grantInstitutionRepresentation(makeFake(base), {
    institutionId: "i-canonical", userId: "u1", programmeId: "p1", actionScope: ["DELETE"], actorUserId: "admin",
  });
  assert.equal(invalid.status, 400);

  const invalidWindow = await governance.grantInstitutionRepresentation(makeFake(base), {
    institutionId: "i-canonical", userId: "u1", programmeId: "p1", actionScope: ["READ"],
    validFrom: new Date("2027-01-01"), validUntil: new Date("2026-01-01"), actorUserId: "admin",
  });
  assert.equal(invalidWindow.status, 400);

  const fake = makeFake(base);
  const granted = await governance.grantInstitutionRepresentation(fake, {
    institutionId: "i-source", userId: "u1", programmeId: "p1", editionId: "e1", actionScope: ["read", "READ"], actorUserId: "admin",
  });
  assert.equal(granted.representationId, "id-1");
  assert.equal(fake.$store.institutionRepresentation[0].institutionId, "i-canonical", "grant lands on the canonical record");
  assert.equal(fake.$store.institutionRepresentation[0].actionScope.join("|"), "READ", "duplicate scope values are normalized");
  assert.equal(fake.audits.length, 1);
  assert.equal(fake.audits[0].action, "institution_representation.grant");
});

test("revokeInstitutionRepresentation is compare-and-set and audited", async () => {
  const fake = makeFake({
    institutionRepresentation: [{ id: "r1", institutionId: "i1", status: "ACTIVE" }],
  });
  const ok = await governance.revokeInstitutionRepresentation(fake, { representationId: "r1", actorUserId: "admin", reason: "offboarded" });
  assert.equal(ok.representationId, "r1");
  assert.equal(fake.$store.institutionRepresentation[0].status, "REVOKED");
  assert.equal(fake.audits.length, 1);
  assert.equal(fake.audits[0].action, "institution_representation.revoke");

  const again = await governance.revokeInstitutionRepresentation(fake, { representationId: "r1", actorUserId: "admin" });
  assert.equal(again.status, 409);
  assert.equal(fake.audits.length, 1, "failed revoke must not append a second audit");
});

test("mergePersonRecords migrates references, transfers the account link, and keeps the alias", async () => {
  const fake = makeFake({
    person: [
      { id: "p-target", userId: null, mergedIntoId: null },
      { id: "p-source", userId: "u1", mergedIntoId: null },
    ],
    speaker: [{ id: "s1", personId: "p-source" }],
    personAffiliation: [{ id: "a1", personId: "p-source" }],
    personRoleProfile: [{ id: "rp1", personId: "p-source" }],
  });
  const result = await governance.mergePersonRecords(fake, { targetId: "p-target", sourceId: "p-source", actorUserId: "admin" });
  assert.equal(result.personId, "p-target");
  assert.equal(fake.$store.speaker[0].personId, "p-target");
  assert.equal(fake.$store.personAffiliation[0].personId, "p-target");
  assert.equal(fake.$store.personRoleProfile[0].personId, "p-target");
  assert.equal(fake.$store.person.find((row) => row.id === "p-target").userId, "u1", "account link moves to the canonical record");
  assert.equal(fake.$store.person.find((row) => row.id === "p-source").mergedIntoId, "p-target");
  assert.equal(fake.audits.length, 1);
  assert.equal(fake.audits[0].action, "person.merge");

  const again = await governance.mergePersonRecords(fake, { targetId: "p-target", sourceId: "p-source", actorUserId: "admin" });
  assert.equal(again.status, 409, "both ids now resolve to the same record");
});

test("mergePersonRecords refuses conflicting account links and self-merge", async () => {
  const fake = makeFake({
    person: [
      { id: "p-target", userId: "u1", mergedIntoId: null },
      { id: "p-source", userId: "u2", mergedIntoId: null },
    ],
    speaker: [], personAffiliation: [], personRoleProfile: [],
  });
  assert.equal((await governance.mergePersonRecords(fake, { targetId: "p-target", sourceId: "p-target", actorUserId: "admin" })).status, 400);
  const conflict = await governance.mergePersonRecords(fake, { targetId: "p-target", sourceId: "p-source", actorUserId: "admin" });
  assert.equal(conflict.status, 409);
});

test("mergeInstitutionRecords migrates relations, merges aliases, deactivates the source", async () => {
  const fake = makeFake({
    institution: [
      { id: "i-target", mergedIntoId: null, aliases: ["old-target"], isActive: true },
      { id: "i-source", slug: "source-slug", mergedIntoId: null, aliases: ["legacy-a", "legacy-b"], isActive: true },
    ],
    activityInstitution: [{ id: "ai1", institutionId: "i-source" }],
    eventInstitution: [{ id: "ei1", institutionId: "i-source" }],
    personAffiliation: [{ id: "pa1", institutionId: "i-source" }],
    personRoleProfile: [{ id: "pr1", scopeInstitutionId: "i-source" }],
    institutionRepresentation: [{ id: "ir1", institutionId: "i-source" }],
  });
  const result = await governance.mergeInstitutionRecords(fake, { targetId: "i-target", sourceId: "i-source", actorUserId: "admin" });
  assert.equal(result.institutionId, "i-target");
  assert.equal(fake.$store.activityInstitution[0].institutionId, "i-target");
  assert.equal(fake.$store.eventInstitution[0].institutionId, "i-target");
  assert.equal(fake.$store.personAffiliation[0].institutionId, "i-target");
  assert.equal(fake.$store.personRoleProfile[0].scopeInstitutionId, "i-target");
  assert.equal(fake.$store.institutionRepresentation[0].institutionId, "i-target");
  const target = fake.$store.institution.find((row) => row.id === "i-target");
  const source = fake.$store.institution.find((row) => row.id === "i-source");
  assert.equal(target.aliases.join("|"), "old-target|source-slug|legacy-a|legacy-b");
  assert.equal(source.mergedIntoId, "i-target");
  assert.equal(source.isActive, false);
  assert.equal(fake.audits[0].action, "institution.merge");
});

test("purpose projections return whitelist fields only", () => {
  const institution = {
    id: "i1", slug: "org", name: "Org", nameEn: "Org EN", shortName: "O", shortNameEn: null,
    logo: "https://example/logo.png", website: "https://example.com",
    countryOrRegion: "China", countryOrRegionEn: "China", verificationStatus: "VERIFIED",
    legalName: "Internal Legal Name", publicContactEmail: "ops@example.com",
    publicContactPhone: "+86", headquartersAddress: "Secret HQ", governanceType: "board",
  };
  const projection = governance.projectInstitutionForPurpose(institution, "institution_context");
  assert.equal(projection.verificationStatus, "VERIFIED");
  for (const internalField of ["legalName", "publicContactEmail", "publicContactPhone", "headquartersAddress", "governanceType"]) {
    assert.equal(internalField in projection, false, `${internalField} must not leak into the projection`);
  }
  assert.equal(governance.projectInstitutionForPurpose(institution, "unknown_purpose"), null, "unknown purpose is default-deny");

  const person = {
    id: "p1", slug: "person", displayName: "Zhang San", displayNameEn: "Sam Zhang",
    avatar: "https://example/a.png", countryOrRegion: "China", countryOrRegionEn: "China",
    verificationStatus: "VERIFIED", bio: "internal bio", orcid: "0000-internal", linkedin: "internal",
  };
  const personProjection = governance.projectPersonForPurpose(person, "person_identity");
  assert.equal(personProjection.displayName, "Zhang San");
  for (const internalField of ["bio", "orcid", "linkedin"]) {
    assert.equal(internalField in personProjection, false, `${internalField} must not leak into the projection`);
  }
  assert.equal(governance.projectPersonForPurpose(person, "unknown_purpose"), null);
});
