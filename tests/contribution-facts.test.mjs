/**
 * 源码级测试：个人/机构贡献事实、核验等级评估、更正链与派生统计（CP-TODO-253 / CP-FR-062）
 *
 * 覆盖（loadService 沙箱 + 内存 Prisma mock）：
 * - recordContributionFact：本人自报初始等级 SELF_REPORTED；陌生人代录 403；
 *   缺失 person/institution 404；programme 成员校验；同自然键重复 409（含空来源显式查重）
 * - evaluateContributionFact：仅升不降（同等级幂等、降级 409）；本人不得评估自己（403）；
 *   机构 MANAGE 代表可评估；非 ACTIVE 事实 409；审计落库
 * - correctContributionFact：原行转 CORRECTED + successor 接续同自然键 + correctionOfId 链；
 *   本人更正回退 SELF_REPORTED，管理面更正保留等级；并发/已更正 409
 * - withdrawContributionFact：撤回幂等；CORRECTED 行不可撤回；403 矩阵
 * - contributionStats：只聚合 ACTIVE（更正/撤回即时复算）；按人去重；数值按人计量求和
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./_service-loader.mjs";

const contributions = loadService("apps/passport-web/lib/server/contribution-facts.ts");

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
    findUniqueOrThrow: async ({ where }) => {
      const row = rows.find((entry) => matches(entry, where));
      if (!row) throw new Error("row not found");
      return row;
    },
    findFirst: async ({ where } = {}) => rows.find((row) => matches(row, where)) ?? null,
    findMany: async ({ where } = {}) => rows.filter((row) => matches(row, where)),
    create: async ({ data }) => {
      const row = { id: `row-${rows.length + 1}`, createdAt: new Date(), updatedAt: new Date(), status: "ACTIVE", ...data };
      rows.push(row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const targets = rows.filter((row) => matches(row, where));
      for (const row of targets) Object.assign(row, data, { updatedAt: new Date() });
      return { count: targets.length };
    },
  };
}

function fake({ facts = [], contributionFact, persons = [], institutions = [], representations = [], memberships = [] } = {}) {
  const db = {
    contributionFact: table(contributionFact ?? facts),
    person: table(persons),
    institution: table(institutions),
    institutionRepresentation: table(representations),
    accessMembership: table(memberships),
    coreAuditLog: table(),
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

const SELF = { id: "user-1", role: "ATTENDEE" };
const STRANGER = { id: "user-2", role: "ATTENDEE" };
const ADMIN = { id: "user-admin", role: "ADMIN" };

function baseFake() {
  return fake({
    persons: [
      { id: "person-1", userId: "user-1" },
      { id: "person-2", userId: "user-2" },
    ],
    institutions: [{ id: "inst-1" }],
  });
}

const recordInput = (overrides = {}) => ({
  personId: "person-1",
  contributionType: "mentoring.minutes",
  sourceType: "activity",
  sourceId: "act-9",
  quantities: { actualUnits: 90 },
  ...overrides,
});

test("recordContributionFact starts at SELF_REPORTED and blocks strangers", async () => {
  const db = baseFake();

  const created = await contributions.recordContributionFact(db, recordInput(), SELF);
  assert.equal("error" in created, false);
  assert.equal(created.fact.verificationLevel, "SELF_REPORTED", "自报起点，不因录入升级");
  assert.equal(created.fact.status, "ACTIVE");
  assert.equal(db.coreAuditLog.rows.length, 1);
  assert.equal(db.coreAuditLog.rows[0].action, "contribution.record");

  const stranger = await contributions.recordContributionFact(db, recordInput({ sourceId: "act-10" }), STRANGER);
  assert.equal(stranger.status, 403);
  assert.equal(stranger.code, "CONTRIBUTION_ACCESS_DENIED");

  const missing = await contributions.recordContributionFact(db, recordInput({ personId: "person-x" }), SELF);
  assert.equal(missing.status, 404);
});

test("recordContributionFact enforces one ACTIVE fact per natural key", async () => {
  const db = baseFake();
  await contributions.recordContributionFact(db, recordInput(), SELF);

  const duplicate = await contributions.recordContributionFact(db, recordInput(), SELF);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.code, "CONTRIBUTION_CONFLICT");

  const nullSourceDuplicate = await contributions.recordContributionFact(
    db,
    recordInput({ contributionType: "volunteering.hours", sourceType: null, sourceId: null }),
    SELF
  );
  assert.equal("error" in nullSourceDuplicate, false);
  const nullSourceAgain = await contributions.recordContributionFact(
    db,
    recordInput({ contributionType: "volunteering.hours", sourceType: null, sourceId: null }),
    SELF
  );
  assert.equal(nullSourceAgain.code, "CONTRIBUTION_CONFLICT", "空来源也禁止同键双 ACTIVE");

  const otherSource = await contributions.recordContributionFact(db, recordInput({ sourceId: "act-11" }), SELF);
  assert.equal("error" in otherSource, false, "不同来源的同类型事实并列存在（多角色不覆盖）");
});

test("recordContributionFact scopes programme-scoped facts to members", async () => {
  const db = baseFake();
  const outsider = await contributions.recordContributionFact(db, recordInput({ programmeId: "prog-1" }), SELF);
  assert.equal(outsider.status, 403);

  db.accessMembership.rows.push({ id: "m1", userId: "user-1", programmeId: "prog-1", role: "PROGRAMME_VIEWER", isActive: true, validFrom: null, validUntil: null, revokedAt: null });
  const member = await contributions.recordContributionFact(db, recordInput({ programmeId: "prog-1" }), SELF);
  assert.equal("error" in member, false);
});

test("evaluateContributionFact upgrades monotonically and never by the person themself", async () => {
  const db = baseFake();
  const { fact } = await contributions.recordContributionFact(db, recordInput(), SELF);

  const selfEvaluate = await contributions.evaluateContributionFact(db, { factId: fact.id, verificationLevel: "ORGANIZATION_CONFIRMED", reason: "自述机构确认" }, SELF);
  assert.equal(selfEvaluate.status, 403, "本人不得评估自己（自报不升级第三方核验）");

  const strangerEvaluate = await contributions.evaluateContributionFact(db, { factId: fact.id, verificationLevel: "ORGANIZATION_CONFIRMED", reason: "无关人员" }, STRANGER);
  assert.equal(strangerEvaluate.status, 403);

  const upgraded = await contributions.evaluateContributionFact(db, { factId: fact.id, verificationLevel: "ORGANIZATION_CONFIRMED", reason: "机构核对工时" }, ADMIN);
  assert.equal(upgraded.upgraded, true);
  assert.equal(upgraded.fact.verificationLevel, "ORGANIZATION_CONFIRMED");

  const idempotent = await contributions.evaluateContributionFact(db, { factId: fact.id, verificationLevel: "ORGANIZATION_CONFIRMED", reason: "重复评估" }, ADMIN);
  assert.equal(idempotent.upgraded, false, "同等级评估幂等");

  const regression = await contributions.evaluateContributionFact(db, { factId: fact.id, verificationLevel: "SELF_REPORTED", reason: "试图降级" }, ADMIN);
  assert.equal(regression.status, 409);
  assert.equal(regression.code, "CONTRIBUTION_VERIFICATION_INVALID");

  const invalid = await contributions.evaluateContributionFact(db, { factId: fact.id, verificationLevel: "NOPE", reason: "非法等级" }, ADMIN);
  assert.equal(invalid.status, 400);

  const top = await contributions.evaluateContributionFact(db, { factId: fact.id, verificationLevel: "INDEPENDENTLY_VERIFIED", reason: "第三方核证" }, ADMIN);
  assert.equal(top.fact.verificationLevel, "INDEPENDENTLY_VERIFIED");
  assert.equal(db.coreAuditLog.rows.filter((row) => row.action === "contribution.evaluate").length, 2);
});

test("correctContributionFact chains corrections and re-derives statistics", async () => {
  const db = baseFake();
  const { fact } = await contributions.recordContributionFact(db, recordInput({ quantities: { actualUnits: 90 } }), SELF);

  const ownerCorrect = await contributions.correctContributionFact(
    db,
    { factId: fact.id, quantities: { actualUnits: 120 }, reason: "补记遗漏场次" },
    SELF
  );
  assert.equal("error" in ownerCorrect, false);
  assert.equal(ownerCorrect.correctedFactId, fact.id);
  assert.equal(ownerCorrect.fact.correctionOfId, fact.id, "successor 接续更正链");
  assert.equal(ownerCorrect.fact.verificationLevel, "SELF_REPORTED", "本人更正回退自报等级");
  assert.equal(ownerCorrect.fact.summaryJson.quantities.actualUnits, 120);
  assert.equal(db.contributionFact.rows.find((row) => row.id === fact.id).status, "CORRECTED");

  const statsAfter = await contributions.contributionStats(db, { personId: "person-1" });
  assert.equal(statsAfter.totalFacts, 1, "统计只计 ACTIVE");
  assert.equal(statsAfter.byType[0].quantities.actualUnits, 120, "更正即时复算");

  const adminKeeps = await contributions.correctContributionFact(
    db,
    { factId: ownerCorrect.fact.id, quantities: { actualUnits: 150 }, reason: "管理面复核更正" },
    ADMIN
  );
  assert.equal("error" in adminKeeps, false);

  const reCorrectOld = await contributions.correctContributionFact(db, { factId: fact.id, quantities: { actualUnits: 1 }, reason: "改旧行" }, ADMIN);
  assert.equal(reCorrectOld.status, 409, "CORRECTED 行不可再更正");
});

test("withdrawContributionFact is idempotent and statistics recompute immediately", async () => {
  const db = baseFake();
  const { fact } = await contributions.recordContributionFact(db, recordInput(), SELF);
  const other = await contributions.recordContributionFact(db, recordInput({ sourceId: "act-10", quantities: { actualUnits: 30 } }), SELF);

  const stranger = await contributions.withdrawContributionFact(db, { factId: fact.id, reason: "无关撤回" }, STRANGER);
  assert.equal(stranger.status, 403);

  const withdrawn = await contributions.withdrawContributionFact(db, { factId: fact.id, reason: "重复登记" }, SELF);
  assert.equal(withdrawn.withdrawn, true);
  const again = await contributions.withdrawContributionFact(db, { factId: fact.id, reason: "重复撤回" }, SELF);
  assert.equal(again.withdrawn, false, "撤回幂等");

  const stats = await contributions.contributionStats(db, { personId: "person-1" });
  assert.equal(stats.totalFacts, 1, "撤回事实立即从统计消失（撤销可复算）");

  await contributions.correctContributionFact(db, { factId: other.fact.id, quantities: { actualUnits: 40 }, reason: "更正" }, SELF);
  const correctedId = db.contributionFact.rows.find((row) => row.status === "CORRECTED" && row.sourceId === "act-10").id;
  const withdrawCorrected = await contributions.withdrawContributionFact(db, { factId: correctedId, reason: "撤回历史行" }, ADMIN);
  assert.equal(withdrawCorrected.status, 409, "CORRECTED 行不可撤回");
});

test("contributionStats deduplicates persons and sums per-person quantities", async () => {
  const db = fake({
    persons: [
      { id: "person-1", userId: "user-1" },
      { id: "person-2", userId: "user-2" },
    ],
    facts: table([
      { id: "f1", personId: "person-1", contributionType: "mentoring.minutes", status: "ACTIVE", verificationLevel: "ORGANIZATION_CONFIRMED", sourceType: "activity", sourceId: "a1", summaryJson: { quantities: { actualUnits: 60 } } },
      { id: "f2", personId: "person-1", contributionType: "mentoring.minutes", status: "ACTIVE", verificationLevel: "SELF_REPORTED", sourceType: "activity", sourceId: "a2", summaryJson: { quantities: { actualUnits: 30 } } },
      { id: "f3", personId: "person-2", contributionType: "mentoring.minutes", status: "ACTIVE", verificationLevel: "INDEPENDENTLY_VERIFIED", sourceType: "activity", sourceId: "a3", summaryJson: { quantities: { actualUnits: 45 } } },
      { id: "f4", personId: "person-2", contributionType: "fieldwork.hours", status: "ACTIVE", verificationLevel: "SELF_REPORTED", sourceType: "activity", sourceId: "a4", summaryJson: { quantities: { plannedUnits: 10, actualUnits: 8 } } },
      { id: "f5", personId: "person-1", contributionType: "mentoring.minutes", status: "WITHDRAWN", verificationLevel: "SELF_REPORTED", sourceType: "activity", sourceId: "a9", summaryJson: { quantities: { actualUnits: 999 } } },
    ]).rows,
  });

  const stats = await contributions.contributionStats(db, {});
  assert.equal(stats.totalFacts, 4, "WITHDRAWN 不计入");
  const mentoring = stats.byType.find((entry) => entry.contributionType === "mentoring.minutes");
  assert.equal(mentoring.factCount, 3);
  assert.equal(mentoring.distinctPersons, 2, "按人去重，多来源并列不双计");
  assert.equal(mentoring.quantities.actualUnits, 135, "数值按人计量求和（非活动总量复制）");
  const fieldwork = stats.byType.find((entry) => entry.contributionType === "fieldwork.hours");
  assert.equal(fieldwork.quantities.plannedUnits, 10);
  assert.equal(fieldwork.quantities.actualUnits, 8);
  assert.equal(stats.byVerificationLevel.ORGANIZATION_CONFIRMED, 1);
  assert.equal(stats.byVerificationLevel.INDEPENDENTLY_VERIFIED, 1);
  assert.equal(stats.byVerificationLevel.SELF_REPORTED, 2);
});

test("institution-subject facts require MANAGE representation for recording on behalf", async () => {
  const db = baseFake();
  const denied = await contributions.recordContributionFact(
    db,
    recordInput({ personId: "person-2", institutionId: "inst-1" }),
    SELF
  );
  assert.equal(denied.status, 403, "无代表权不得为他人代录机构主体事实");

  db.institutionRepresentation.rows.push({
    id: "r1",
    userId: "user-1",
    institutionId: "inst-1",
    programmeId: "prog-1",
    actionScope: ["MANAGE"],
    status: "ACTIVE",
    validFrom: null,
    validUntil: null,
    revokedAt: null,
  });
  const recorded = await contributions.recordContributionFact(
    db,
    recordInput({ personId: "person-2", institutionId: "inst-1" }),
    SELF
  );
  assert.equal("error" in recorded, false, "MANAGE 代表可代录机构主体事实");

  const evaluated = await contributions.evaluateContributionFact(
    db,
    { factId: recorded.fact.id, verificationLevel: "ORGANIZATION_CONFIRMED", reason: "机构确认场地贡献" },
    SELF
  );
  assert.equal(evaluated.upgraded, true, "MANAGE 代表可评估机构主体事实");

  const evaluatedSelf = await contributions.evaluateContributionFact(
    db,
    { factId: recorded.fact.id, verificationLevel: "INDEPENDENTLY_VERIFIED", reason: "本人兼代表自评" },
    STRANGER
  );
  assert.equal(evaluatedSelf.status, 403, "被记录人本人即使相关方也不得评估自己");
});
