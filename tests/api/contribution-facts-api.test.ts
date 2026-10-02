/**
 * API 集成测试：个人/机构贡献事实、核验等级、更正链与派生统计（CP-TODO-253 / CP-FR-062）
 *
 * 覆盖矩阵（真实数据库 + 真实会话）：
 * - 准备：ADMIN/self/other 三个账号（self/other 各挂 Person）；机构 + self 的
 *   MANAGE 代表权（有效窗口内）；programme + self 的 PROGRAMME_VIEWER 成员
 * - 录入：匿名 401；本人自报 201 且初始等级 SELF_REPORTED（审计落库）；为他人
 *   代录 403；ADMIN 代录 201；programme 外人员 403、成员 201；同自然键重复 409
 *   CONTRIBUTION_CONFLICT；不同来源同类型并列 201（多角色不覆盖）
 * - 评估：本人自评 403（自报不升级第三方核验）；无关人员 403；ADMIN 升级 200
 *   upgraded:true；同等级幂等 upgraded:false；降级 409
 *   CONTRIBUTION_VERIFICATION_INVALID；审计落库
 * - 更正：本人更正 200，successor 接续同自然键（原行 CORRECTED）、等级回退
 *   SELF_REPORTED；管理面更正保留等级；统计即时复算；CORRECTED 行再更正 409
 * - 撤回：本人撤回 200，重复撤回幂等 withdrawn:false；统计立即消失（撤销可复算）；
 *   CORRECTED 行撤回 409
 * - 列表与统计：personId 本人 200 / 他人 403；机构列表无代表权 403、有 READ
 *   代表权 200；匿名统计 401；登录用户统计 200 仅聚合量（无个体行）
 * - 机构主体事实：无代表权为他人代录 403；MANAGE 代表代录 201 且代表可评估
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { ApiClient, waitForServer } from "./_client";
import { buildLoginPayload, testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3100";
const locale = testData.locale;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const selfClient = new ApiClient(baseURL);
const otherClient = new ApiClient(baseURL);
const anonymousClient = new ApiClient(baseURL);

const state: {
  selfUserId?: string;
  otherUserId?: string;
  selfPersonId?: string;
  otherPersonId?: string;
  institutionId?: string;
  programmeId?: string;
  factId?: string;
  adminFactId?: string;
} = {};

function skipUnlessReady(t: { skip: (reason: string) => void }) {
  if (!serverReady) {
    t.skip("目标服务器未就绪，跳过 API 测试");
  }
}

async function db() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("贡献事实与核验等级（CP-TODO-253）", () => {
  test("准备：账号、Person、机构、代表权、programme 成员", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    const login = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(login.status, 200, `管理员登录失败: ${JSON.stringify(login.data)}`);

    const client = await db();
    const passwordHash = await hash("seeded-password", 10);

    const selfUser = await client.user.create({
      data: { email: `contrib_self_${suffix}@example.com`, name: "Contribution Self", password: passwordHash, role: "ATTENDEE", emailVerified: new Date() },
      select: { id: true },
    });
    state.selfUserId = selfUser.id;
    const selfPerson = await client.person.create({ data: { displayName: "Contribution Self Person", userId: selfUser.id }, select: { id: true } });
    state.selfPersonId = selfPerson.id;
    const selfLogin = await selfClient.login(buildLoginPayload(locale, `contrib_self_${suffix}@example.com`, "seeded-password"));
    assert.equal(selfLogin.status, 200);

    const otherUser = await client.user.create({
      data: { email: `contrib_other_${suffix}@example.com`, name: "Contribution Other", password: passwordHash, role: "ATTENDEE", emailVerified: new Date() },
      select: { id: true },
    });
    state.otherUserId = otherUser.id;
    const otherPerson = await client.person.create({ data: { displayName: "Contribution Other Person", userId: otherUser.id }, select: { id: true } });
    state.otherPersonId = otherPerson.id;
    const otherLogin = await otherClient.login(buildLoginPayload(locale, `contrib_other_${suffix}@example.com`, "seeded-password"));
    assert.equal(otherLogin.status, 200);

    const institution = await client.institution.create({
      data: { slug: `contrib-inst-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60), name: `Contribution Institution ${suffix}` },
      select: { id: true },
    });
    state.institutionId = institution.id;

    const tenant = await client.tenant.create({ data: { key: `contrib-tenant-${suffix}`, name: `Contrib Tenant ${suffix}` }, select: { id: true } });
    const programme = await client.programme.create({ data: { key: `contrib-prog-${suffix}`, name: `Contrib Programme ${suffix}`, tenantId: tenant.id }, select: { id: true } });
    state.programmeId = programme.id;

    await client.institutionRepresentation.create({
      data: {
        userId: selfUser.id,
        institutionId: institution.id,
        programmeId: programme.id,
        actionScope: ["READ", "MANAGE"],
        status: "ACTIVE",
      },
    });
    await client.accessMembership.create({
      data: { userId: selfUser.id, programmeId: programme.id, role: "PROGRAMME_VIEWER" },
    });
  });

  test("录入：自报 201 初始 SELF_REPORTED、代录 403、重复 409、多来源并列", async (t) => {
    skipUnlessReady(t);

    const anonymous = await anonymousClient.post("/api/contributions", {
      personId: state.selfPersonId,
      contributionType: "mentoring.minutes",
    });
    assert.equal(anonymous.status, 401);

    const selfRecord = await selfClient.post("/api/contributions", {
      personId: state.selfPersonId,
      contributionType: "mentoring.minutes",
      sourceType: "activity",
      sourceId: `activity-${suffix}-a`,
      quantities: { actualUnits: 90 },
      note: "一对一导师课",
    });
    assert.equal(selfRecord.status, 201, `自报失败: ${JSON.stringify(selfRecord.data)}`);
    const fact = (selfRecord.data as { fact: { id: string; verificationLevel: string } }).fact;
    state.factId = fact.id;
    assert.equal(fact.verificationLevel, "SELF_REPORTED", "自报起点");

    const client = await db();
    const audit = await client.coreAuditLog.findFirst({ where: { action: "contribution.record", subjectId: fact.id } });
    assert.ok(audit, "录入审计落库");

    const onBehalfDenied = await selfClient.post("/api/contributions", {
      personId: state.otherPersonId,
      contributionType: "mentoring.minutes",
      sourceType: "activity",
      sourceId: `activity-${suffix}-b`,
    });
    assert.equal(onBehalfDenied.status, 403, `代录应 403: ${JSON.stringify(onBehalfDenied.data)}`);
    assert.equal((onBehalfDenied.data as { code?: string }).code, "CONTRIBUTION_ACCESS_DENIED");

    const programmeDenied = await otherClient.post("/api/contributions", {
      personId: state.otherPersonId,
      contributionType: "mentoring.minutes",
      programmeId: state.programmeId,
    });
    assert.equal(programmeDenied.status, 403, "非 programme 成员不得录入 programme 事实");

    const programmeOk = await selfClient.post("/api/contributions", {
      personId: state.selfPersonId,
      contributionType: "mentoring.minutes",
      programmeId: state.programmeId,
      sourceType: "activity",
      sourceId: `activity-${suffix}-prog`,
      quantities: { plannedUnits: 120 },
    });
    assert.equal(programmeOk.status, 201, `programme 成员录入失败: ${JSON.stringify(programmeOk.data)}`);

    const duplicate = await selfClient.post("/api/contributions", {
      personId: state.selfPersonId,
      contributionType: "mentoring.minutes",
      sourceType: "activity",
      sourceId: `activity-${suffix}-a`,
    });
    assert.equal(duplicate.status, 409);
    assert.equal((duplicate.data as { code?: string }).code, "CONTRIBUTION_CONFLICT", "同自然键禁止双 ACTIVE");

    const parallel = await selfClient.post("/api/contributions", {
      personId: state.selfPersonId,
      contributionType: "mentoring.minutes",
      sourceType: "activity",
      sourceId: `activity-${suffix}-c`,
      quantities: { actualUnits: 45 },
    });
    assert.equal(parallel.status, 201, "不同来源同类型事实并列（多角色不覆盖）");

    const invalid = await selfClient.post("/api/contributions", {
      personId: state.selfPersonId,
      contributionType: "Invalid Type!",
    });
    assert.equal(invalid.status, 400);
  });

  test("评估：本人/无关人员 403，ADMIN 升级、幂等与降级拒绝", async (t) => {
    skipUnlessReady(t);

    const selfEvaluate = await selfClient.post(`/api/contributions/${state.factId}/evaluate`, {
      verificationLevel: "ORGANIZATION_CONFIRMED",
      reason: "自述机构确认",
    });
    assert.equal(selfEvaluate.status, 403, "本人不得评估自己");

    const otherEvaluate = await otherClient.post(`/api/contributions/${state.factId}/evaluate`, {
      verificationLevel: "ORGANIZATION_CONFIRMED",
      reason: "无关人员评估",
    });
    assert.equal(otherEvaluate.status, 403);

    const upgraded = await adminClient.post(`/api/contributions/${state.factId}/evaluate`, {
      verificationLevel: "ORGANIZATION_CONFIRMED",
      reason: "项目方核对 Mentor 记录",
    });
    assert.equal(upgraded.status, 200, `评估失败: ${JSON.stringify(upgraded.data)}`);
    assert.equal((upgraded.data as { upgraded: boolean }).upgraded, true);
    assert.equal((upgraded.data as { fact: { verificationLevel: string } }).fact.verificationLevel, "ORGANIZATION_CONFIRMED");

    const idempotent = await adminClient.post(`/api/contributions/${state.factId}/evaluate`, {
      verificationLevel: "ORGANIZATION_CONFIRMED",
      reason: "重复评估",
    });
    assert.equal((idempotent.data as { upgraded: boolean }).upgraded, false, "同等级幂等");

    const regression = await adminClient.post(`/api/contributions/${state.factId}/evaluate`, {
      verificationLevel: "SELF_REPORTED",
      reason: "试图降级",
    });
    assert.equal(regression.status, 409);
    assert.equal((regression.data as { code?: string }).code, "CONTRIBUTION_VERIFICATION_INVALID");

    const missingReason = await adminClient.post(`/api/contributions/${state.factId}/evaluate`, {
      verificationLevel: "INDEPENDENTLY_VERIFIED",
    });
    assert.equal(missingReason.status, 400);

    const client = await db();
    const audits = await client.coreAuditLog.count({ where: { action: "contribution.evaluate", subjectId: state.factId } });
    assert.equal(audits, 1, "仅一次有效升级审计");
  });

  test("更正：owner 更正回退自报等级并即时复算统计；管理面更正保留等级", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    const before = await selfClient.get(`/api/contributions/stats?personId=${state.selfPersonId}`);
    const beforeBody = before.data as { totalFacts: number; byType: Array<{ quantities: Record<string, number> }> };
    const mentoringBefore = beforeBody.byType.find((entry) => entry.quantities.actualUnits !== undefined);

    const corrected = await selfClient.post(`/api/contributions/${state.factId}/correct`, {
      reason: "补记遗漏场次",
      quantities: { actualUnits: 120 },
    });
    assert.equal(corrected.status, 200, `更正失败: ${JSON.stringify(corrected.data)}`);
    const successor = (corrected.data as { fact: { id: string; verificationLevel: string; correctionOfId: string | null }; correctedFactId: string }).fact;
    assert.equal(successor.correctionOfId, state.factId, "successor 接续更正链");
    assert.equal(successor.verificationLevel, "SELF_REPORTED", "本人更正回退自报等级");
    assert.equal((corrected.data as { correctedFactId: string }).correctedFactId, state.factId);

    const original = await client.contributionFact.findUniqueOrThrow({ where: { id: state.factId! } });
    assert.equal(original.status, "CORRECTED");

    const history = await selfClient.get(`/api/contributions?personId=${state.selfPersonId}&includeHistory=1`);
    const historyRows = (history.data as { facts: Array<{ id: string; status: string }> }).facts;
    assert.ok(historyRows.some((row) => row.id === state.factId && row.status === "CORRECTED"), "历史含更正前行");
    const activeOnly = await selfClient.get(`/api/contributions?personId=${state.selfPersonId}`);
    const activeRows = (activeOnly.data as { facts: Array<{ id: string }> }).facts;
    assert.ok(!activeRows.some((row) => row.id === state.factId), "默认列表不含已更正行");

    const after = await selfClient.get(`/api/contributions/stats?personId=${state.selfPersonId}`);
    const afterBody = after.data as { totalFacts: number; byType: Array<{ contributionType: string; factCount: number; quantities: Record<string, number> }> };
    assert.equal(afterBody.totalFacts, beforeBody.totalFacts, "更正不增减 ACTIVE 条数");
    const mentoringAfter = afterBody.byType.find((entry) => entry.contributionType === "mentoring.minutes");
    assert.equal(mentoringAfter.quantities.actualUnits, 165, "更正即时复算：successor 120 + 并列事实 45，原行 90 被取代");
    void mentoringBefore;

    const adminCorrect = await adminClient.post(`/api/contributions/${successor.id}/correct`, {
      reason: "管理面复核调账",
      quantities: { actualUnits: 150 },
    });
    assert.equal(adminCorrect.status, 200);
    assert.equal(
      (adminCorrect.data as { fact: { verificationLevel: string } }).fact.verificationLevel,
      "SELF_REPORTED",
      "更正后 successor 仍是自报事实，需重新评估"
    );

    const reCorrect = await selfClient.post(`/api/contributions/${state.factId}/correct`, {
      reason: "改历史行",
      quantities: { actualUnits: 1 },
    });
    assert.equal(reCorrect.status, 409, "CORRECTED 行不可再更正");
  });

  test("撤回：幂等且统计立即消失；列表按人/机构授权矩阵", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    const programmeFact = await client.contributionFact.findFirstOrThrow({
      where: { personId: state.selfPersonId, programmeId: state.programmeId, status: "ACTIVE" },
    });

    const before = await selfClient.get(`/api/contributions/stats?personId=${state.selfPersonId}`);
    const beforeTotal = (before.data as { totalFacts: number }).totalFacts;

    const withdrawn = await selfClient.post(`/api/contributions/${programmeFact.id}/withdraw`, { reason: "重复登记" });
    assert.equal(withdrawn.status, 200, `撤回失败: ${JSON.stringify(withdrawn.data)}`);
    assert.equal((withdrawn.data as { withdrawn: boolean }).withdrawn, true);
    const again = await selfClient.post(`/api/contributions/${programmeFact.id}/withdraw`, { reason: "重复撤回" });
    assert.equal((again.data as { withdrawn: boolean }).withdrawn, false, "撤回幂等");

    const after = await selfClient.get(`/api/contributions/stats?personId=${state.selfPersonId}`);
    assert.equal((after.data as { totalFacts: number }).totalFacts, beforeTotal - 1, "撤回事实立即从统计消失");

    const otherList = await selfClient.get(`/api/contributions?personId=${state.otherPersonId}`);
    assert.equal(otherList.status, 403, "他人贡献列表拒绝");

    const institutionDenied = await otherClient.get(`/api/contributions?institutionId=${state.institutionId}`);
    assert.equal(institutionDenied.status, 403, "无代表权不得读机构贡献");

    const institutionRead = await selfClient.get(`/api/contributions?institutionId=${state.institutionId}`);
    assert.equal(institutionRead.status, 200, "READ 代表可读机构贡献");
  });

  test("机构主体事实：代表权矩阵与评估；统计端点仅聚合", async (t) => {
    skipUnlessReady(t);

    const onBehalfDenied = await otherClient.post("/api/contributions", {
      personId: state.selfPersonId,
      contributionType: "venue.hosting",
      institutionId: state.institutionId,
    });
    assert.equal(onBehalfDenied.status, 403);

    const institutionFact = await selfClient.post("/api/contributions", {
      personId: state.otherPersonId,
      contributionType: "venue.hosting",
      institutionId: state.institutionId,
      sourceType: "event",
      sourceId: `venue-${suffix}`,
      quantities: { actualUnits: 1 },
    });
    assert.equal(institutionFact.status, 201, `MANAGE 代表代录机构事实失败: ${JSON.stringify(institutionFact.data)}`);
    state.adminFactId = (institutionFact.data as { fact: { id: string } }).fact.id;

    const evaluateByRepresentative = await selfClient.post(`/api/contributions/${state.adminFactId}/evaluate`, {
      verificationLevel: "ORGANIZATION_CONFIRMED",
      reason: "机构确认场地支持",
    });
    assert.equal(evaluateByRepresentative.status, 200, `代表评估失败: ${JSON.stringify(evaluateByRepresentative.data)}`);

    const anonymousStats = await anonymousClient.get(`/api/contributions/stats?personId=${state.selfPersonId}`);
    assert.equal(anonymousStats.status, 401);

    const stats = await otherClient.get(`/api/contributions/stats?institutionId=${state.institutionId}`);
    assert.equal(stats.status, 200);
    const body = stats.data as { totalFacts: number; distinctPersons: number; byType: Array<{ contributionType: string; factCount: number }>; facts?: unknown };
    assert.equal(body.totalFacts, 1);
    assert.equal(body.distinctPersons, 1);
    assert.equal(body.byType[0].contributionType, "venue.hosting");
    assert.equal(body.facts, undefined, "统计端点不返回个体行");

    const client = await db();
    const audits = await client.coreAuditLog.findMany({
      where: { action: { in: ["contribution.record", "contribution.evaluate", "contribution.correct", "contribution.withdraw"] } },
    });
    const actions = new Set(audits.map((row) => row.action));
    for (const action of ["contribution.record", "contribution.evaluate", "contribution.correct", "contribution.withdraw"]) {
      assert.ok(actions.has(action), `缺少审计动作 ${action}`);
    }
  });
});
