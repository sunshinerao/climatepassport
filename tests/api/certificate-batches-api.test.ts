/**
 * API 集成测试：持久化证书批量签发（CP-TODO-228）
 *
 * 覆盖：
 * - 批量签发预检（POST /api/admin/certificates/batches/preflight）
 * - 批次创建与幂等键重放（POST /api/admin/certificates/batches）
 * - 分批处理直至完成（POST /api/admin/certificates/batches/[id]/process）
 * - 部分失败与重试失败项（POST /api/admin/certificates/batches/[id]/retry-failed）
 * - Activity 合格名单服务端推导（source=ACTIVITY_ELIGIBLE_LIST）
 * - 真实数据库断言：逐项状态、证书 issue sourceId、站内通知数量、审计记录
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { ApiClient, waitForServer } from "./_client";
import { buildLoginPayload, testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3100";
const locale = testData.locale;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
let adminLoggedIn = false;

const state: {
  categoryId?: string;
  templateId?: string;
  definitionId?: string;
  activityId?: string;
  attendeeUserId?: string;
  batchAId?: string;
  batchARecipient?: string;
  batchBId?: string;
  batchCId?: string;
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

async function ensureAdminLoggedIn(t: { skip: (reason: string) => void }) {
  if (adminLoggedIn) {
    return true;
  }
  const admin = testData.seededUsers.admin;
  const loginResponse = await adminClient.login(buildLoginPayload(locale, admin.email, admin.password));
  if (loginResponse.status === 403 && (loginResponse.data as { requiresVerification?: boolean }).requiresVerification) {
    t.skip("管理员账号未验证邮箱，跳过批量签发测试");
    return false;
  }
  assert.equal(loginResponse.status, 200, `管理员登录失败: ${JSON.stringify(loginResponse.data)}`);
  adminLoggedIn = true;
  return true;
}

async function processBatchUntilTerminal(batchId: string, maxCalls = 30) {
  let lastBatch: { status: string; succeededCount: number; failedCount: number; totalCount: number } | null = null;
  for (let attempt = 0; attempt < maxCalls; attempt += 1) {
    const response = await adminClient.post(`/api/admin/certificates/batches/${batchId}/process`, {});
    assert.equal(response.status, 200, `处理批次失败: ${JSON.stringify(response.data)}`);
    const data = response.data as {
      batch: { status: string; succeededCount: number; failedCount: number; totalCount: number };
      processedItems: Array<{ id: string; status: string }>;
    };
    lastBatch = data.batch;
    if (["COMPLETED", "COMPLETED_WITH_FAILURES", "FAILED"].includes(data.batch.status)) {
      return data.batch;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`批次 ${batchId} 未在 ${maxCalls} 次处理内进入终态: ${JSON.stringify(lastBatch)}`);
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("证书批量签发 API", () => {
  test("准备：创建测试分类与模板", async (t) => {
    skipUnlessReady(t);
    if (!(await ensureAdminLoggedIn(t))) return;

    const categoryResponse = await adminClient.post("/api/admin/certificates/categories", {
      key: `batch-test-${suffix}`.slice(0, 60).toLowerCase(),
      name: `Batch Test Category ${suffix}`,
      nameEn: `Batch Test Category ${suffix}`,
      isActive: true,
    });
    assert.ok([200, 201].includes(categoryResponse.status), `创建分类失败: ${JSON.stringify(categoryResponse.data)}`);
    const category = (categoryResponse.data as { category?: { id: string } }).category
      ?? (categoryResponse.data as { id?: string });
    const categoryId = (category as { id?: string }).id;
    assert.ok(categoryId, "应返回分类 id");

    const templateResponse = await adminClient.post("/api/admin/certificates/templates", {
      categoryId,
      name: `Batch Test Certificate ${suffix}`,
      nameEn: `Batch Test Certificate ${suffix}`,
      templateType: "ACHIEVEMENT",
      pageSize: "A4_LANDSCAPE",
      isActive: true,
      definitionName: `Batch Test Definition ${suffix}`,
      approvalMode: "auto",
    });
    assert.ok([200, 201].includes(templateResponse.status), `创建模板失败: ${JSON.stringify(templateResponse.data)}`);
    const templateData = templateResponse.data as { template?: { id: string }; definition?: { id: string } };
    state.templateId = templateData.template?.id;
    state.definitionId = templateData.definition?.id;
    state.categoryId = categoryId;
    assert.ok(state.templateId, "应返回模板 id");
    assert.ok(state.definitionId, "应返回定义 id");
  });

  test("匿名与普通用户不能访问批量签发接口", async (t) => {
    skipUnlessReady(t);

    const anonymous = new ApiClient(baseURL);
    const response = await anonymous.post("/api/admin/certificates/batches", {
      idempotencyKey: randomUUID(),
      templateId: state.templateId ?? randomUUID(),
      source: "MANUAL_LIST",
      recipients: "a@example.com",
    });
    assert.ok([401, 403].includes(response.status), `匿名访问应被拒绝: ${response.status}`);

    const attendee = new ApiClient(baseURL);
    const attendeeUser = testData.seededUsers.attendee;
    const loginResponse = await attendee.login(buildLoginPayload(locale, attendeeUser.email, attendeeUser.password));
    if (loginResponse.status === 200) {
      const forbidden = await attendee.post("/api/admin/certificates/batches", {
        idempotencyKey: randomUUID(),
        templateId: state.templateId ?? randomUUID(),
        source: "MANUAL_LIST",
        recipients: "a@example.com",
      });
      assert.equal(forbidden.status, 403, `普通用户访问应返回 403: ${JSON.stringify(forbidden.data)}`);
      const preflightForbidden = await attendee.post("/api/admin/certificates/batches/preflight", {
        templateId: state.templateId ?? randomUUID(),
        source: "MANUAL_LIST",
        recipients: "a@example.com",
      });
      assert.equal(preflightForbidden.status, 403);
    }
  });

  test("预检报告标记格式错误、重复和已签发收件人", async (t) => {
    skipUnlessReady(t);
    if (!(await ensureAdminLoggedIn(t))) return;
    if (!state.templateId) {
      t.skip("缺少测试模板");
      return;
    }

    state.batchARecipient = `batch-a-${suffix}@example.com`;
    const response = await adminClient.post("/api/admin/certificates/batches/preflight", {
      templateId: state.templateId,
      source: "MANUAL_LIST",
      recipients: `${state.batchARecipient}\nnot-an-email\n${state.batchARecipient}`,
    });

    assert.equal(response.status, 200, `预检失败: ${JSON.stringify(response.data)}`);
    const report = (response.data as { report: {
      rows: Array<{ state: string }>;
      summary: { total: number; valid: number; malformed: number; duplicates: number; existingIssues: number };
    } }).report;
    assert.equal(report.summary.total, 3);
    assert.equal(report.summary.valid, 1);
    assert.equal(report.summary.malformed, 1);
    assert.equal(report.summary.duplicates, 1);
    assert.equal(report.summary.existingIssues, 0);
  });

  test("创建批次幂等：相同幂等键返回同一批次", async (t) => {
    skipUnlessReady(t);
    if (!(await ensureAdminLoggedIn(t))) return;
    if (!state.templateId || !state.batchARecipient) {
      t.skip("缺少测试前置数据");
      return;
    }

    const idempotencyKey = randomUUID();
    const payload = {
      idempotencyKey,
      templateId: state.templateId,
      source: "MANUAL_LIST",
      recipients: `${state.batchARecipient}\nnot-an-email\n${state.batchARecipient}`,
      issueDate: "2026-09-18",
      notify: true,
    };

    const created = await adminClient.post("/api/admin/certificates/batches", payload);
    assert.equal(created.status, 201, `创建批次失败: ${JSON.stringify(created.data)}`);
    const createdData = created.data as { replayed?: boolean; batch: { id: string; totalCount: number; status: string } };
    assert.equal(createdData.replayed, false);
    assert.equal(createdData.batch.totalCount, 1, "格式错误与重复行不得创建批次项");
    assert.equal(createdData.batch.status, "PENDING");
    state.batchAId = createdData.batch.id;

    const replayed = await adminClient.post("/api/admin/certificates/batches", payload);
    assert.equal(replayed.status, 200, `幂等重放失败: ${JSON.stringify(replayed.data)}`);
    const replayedData = replayed.data as { replayed?: boolean; batch: { id: string } };
    assert.equal(replayedData.replayed, true);
    assert.equal(replayedData.batch.id, state.batchAId, "相同幂等键必须返回同一批次");

    const database = await db();
    const itemCount = await database.certificateBatchItem.count({ where: { batchId: state.batchAId } });
    assert.equal(itemCount, 1);
  });

  test("分批处理到完成：真实证书、通知与审计", async (t) => {
    skipUnlessReady(t);
    if (!(await ensureAdminLoggedIn(t))) return;
    if (!state.batchAId || !state.batchARecipient) {
      t.skip("缺少批次 A");
      return;
    }

    const finalBatch = await processBatchUntilTerminal(state.batchAId);
    assert.equal(finalBatch.status, "COMPLETED");
    assert.equal(finalBatch.succeededCount, 1);
    assert.equal(finalBatch.failedCount, 0);

    const database = await db();
    const items = await database.certificateBatchItem.findMany({ where: { batchId: state.batchAId } });
    assert.equal(items.length, 1);
    assert.equal(items[0].status, "SUCCEEDED");
    assert.ok(items[0].certificateIssueId, "成功项必须关联已签发证书");

    const issues = await database.certificateIssue.findMany({
      where: { sourceType: "CERTIFICATE_BATCH", sourceId: `certificate-batch-item:${items[0].id}` },
    });
    assert.equal(issues.length, 1, "每项恰好一张批次证书（对账键唯一）");
    assert.equal(issues[0].status, "ISSUED");
    assert.ok(issues[0].artifactKey?.endsWith(".pdf"), "批次签发必须生成真实 PDF 产物");

    const recipient = await database.user.findUnique({ where: { email: state.batchARecipient } });
    assert.ok(recipient, "收件人应已开户");
    const notifications = await database.notification.count({
      where: { userId: recipient!.id, kind: "CERTIFICATE", metadata: { path: ["batchId"], equals: state.batchAId } },
    });
    assert.equal(notifications, 1, "每个新签发证书恰好一条站内通知");

    const auditActions = await database.coreAuditLog.findMany({
      where: { subjectType: "certificate_batch", subjectId: state.batchAId },
      select: { action: true },
    });
    const actions = auditActions.map((entry) => entry.action);
    assert.ok(actions.includes("certificate.batch_created"), "批次创建必须有审计");
    assert.ok(actions.includes("certificate.batch_completed"), "批次完成必须有审计");

    // 再次处理已完成批次：不得重复签发或重复通知。
    const reprocess = await adminClient.post(`/api/admin/certificates/batches/${state.batchAId}/process`, {});
    assert.equal(reprocess.status, 200);
    const notificationsAfter = await database.notification.count({
      where: { userId: recipient!.id, kind: "CERTIFICATE", metadata: { path: ["batchId"], equals: state.batchAId } },
    });
    assert.equal(notificationsAfter, 1, "重试成功项不得重复通知");
  });

  test("部分失败：重复收件人失败，其余成功，可查询逐项状态", async (t) => {
    skipUnlessReady(t);
    if (!(await ensureAdminLoggedIn(t))) return;
    if (!state.templateId || !state.batchARecipient) {
      t.skip("缺少测试前置数据");
      return;
    }

    const secondRecipient = `batch-b-${suffix}@example.com`;
    const created = await adminClient.post("/api/admin/certificates/batches", {
      idempotencyKey: randomUUID(),
      templateId: state.templateId,
      source: "MANUAL_LIST",
      recipients: `${state.batchARecipient}\n${secondRecipient}`,
      notify: true,
    });
    assert.equal(created.status, 201, `创建批次失败: ${JSON.stringify(created.data)}`);
    state.batchBId = (created.data as { batch: { id: string } }).batch.id;

    const finalBatch = await processBatchUntilTerminal(state.batchBId);
    assert.equal(finalBatch.status, "COMPLETED_WITH_FAILURES");
    assert.equal(finalBatch.succeededCount, 1);
    assert.equal(finalBatch.failedCount, 1);

    const detail = await adminClient.get(`/api/admin/certificates/batches/${state.batchBId}`);
    assert.equal(detail.status, 200);
    const items = (detail.data as { items: Array<{ email: string; status: string; error?: string | null; attempts: number }> }).items;
    assert.equal(items.length, 2);
    const failed = items.find((item) => item.email === state.batchARecipient);
    const succeeded = items.find((item) => item.email === secondRecipient);
    assert.equal(failed?.status, "FAILED");
    assert.ok(failed?.error?.includes("Duplicate issuance is not allowed"), `重复项应报告重复错误: ${failed?.error}`);
    assert.equal(succeeded?.status, "SUCCEEDED");

    // 重试失败项：重复项保持失败（真实状态），成功项不受影响。
    const retry = await adminClient.post(`/api/admin/certificates/batches/${state.batchBId}/retry-failed`, {});
    assert.equal(retry.status, 200);
    const retriedBatch = (retry.data as { batch: { status: string; failedCount: number; succeededCount: number } }).batch;
    assert.equal(retriedBatch.status, "COMPLETED_WITH_FAILURES");
    assert.equal(retriedBatch.failedCount, 1);
    assert.equal(retriedBatch.succeededCount, 1);

    const database = await db();
    const succeededItem = items.find((item) => item.email === secondRecipient);
    const notifications = await database.notification.count({
      where: { kind: "CERTIFICATE", metadata: { path: ["batchId"], equals: state.batchBId } },
    });
    assert.equal(notifications, 1, "批次 B 中只有新签发成功的一项产生通知");
    const issueRows = await database.certificateIssue.count({
      where: { sourceType: "CERTIFICATE_BATCH", user: { email: secondRecipient } },
    });
    assert.equal(issueRows, 1, "重试不得为已成功收件人重复签发");
    assert.ok(succeededItem);
  });

  test("活动合格名单由服务端推导，忽略客户端名单", async (t) => {
    skipUnlessReady(t);
    if (!(await ensureAdminLoggedIn(t))) return;
    if (!state.templateId) {
      t.skip("缺少测试模板");
      return;
    }

    const database = await db();
    const adminUser = await database.user.findUnique({ where: { email: testData.seededUsers.admin.email } });
    assert.ok(adminUser, "管理员用户应存在");

    const activityResponse = await adminClient.post("/api/activities", {
      type: "EVENT",
      title: `Batch Eligible Activity ${suffix}`,
      titleEn: `Batch Eligible Activity ${suffix}`,
      slug: `batch-eligible-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60),
      summary: "Batch issuance eligible list test activity.",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      locationType: "ONLINE",
      createdByUserId: adminUser!.id,
    });
    assert.ok([200, 201].includes(activityResponse.status), `创建活动失败: ${JSON.stringify(activityResponse.data)}`);
    state.activityId = (activityResponse.data as { activity?: { id: string } }).activity?.id;
    assert.ok(state.activityId, "应返回活动 id");

    const attendee = testData.seededUsers.attendee;
    const attendeeUser = await database.user.findUnique({ where: { email: attendee.email } });
    assert.ok(attendeeUser, "种子用户应存在");
    state.attendeeUserId = attendeeUser!.id;

    const participationResponse = await adminClient.post("/api/activity-participations", {
      activityId: state.activityId,
      userId: state.attendeeUserId,
    });
    assert.ok([200, 201].includes(participationResponse.status), `创建参与记录失败: ${JSON.stringify(participationResponse.data)}`);
    const participationId = (participationResponse.data as { participation?: { id: string } }).participation?.id;
    assert.ok(participationId);

    const accept = await adminClient.patch(`/api/activity-participations/${participationId}`, { status: "ACCEPTED" });
    assert.equal(accept.status, 200, `参与状态流转失败: ${JSON.stringify(accept.data)}`);
    const complete = await adminClient.patch(`/api/activity-participations/${participationId}`, { status: "COMPLETED" });
    assert.equal(complete.status, 200, `参与状态流转失败: ${JSON.stringify(complete.data)}`);

    const preflight = await adminClient.post("/api/admin/certificates/batches/preflight", {
      templateId: state.templateId,
      source: "ACTIVITY_ELIGIBLE_LIST",
      activityId: state.activityId,
    });
    assert.equal(preflight.status, 200, `活动预检失败: ${JSON.stringify(preflight.data)}`);
    const preflightData = preflight.data as { report: { activity?: { eligibleCount: number }; recipients?: Array<{ email: string }> } };
    assert.ok(preflightData.report.activity, "活动预检应返回活动信息");
    assert.ok(
      preflightData.report.recipients?.some((recipient) => recipient.email === attendee.email),
      "合格名单应包含已完成参与的种子用户",
    );

    const created = await adminClient.post("/api/admin/certificates/batches", {
      idempotencyKey: randomUUID(),
      templateId: state.templateId,
      source: "ACTIVITY_ELIGIBLE_LIST",
      activityId: state.activityId,
      recipients: "mallory@example.com",
      notify: true,
    });
    assert.equal(created.status, 201, `创建活动批次失败: ${JSON.stringify(created.data)}`);
    const createdBatch = (created.data as { batch: { id: string; totalCount: number } }).batch;
    state.batchCId = createdBatch.id;
    assert.equal(createdBatch.totalCount, 1, "客户端伪造名单必须被忽略，仅服务端推导名单入批");

    const items = (created.data as { items: Array<{ email: string }> }).items;
    assert.deepEqual(items.map((item) => item.email), [attendee.email]);

    const finalBatch = await processBatchUntilTerminal(state.batchCId);
    assert.equal(finalBatch.status, "COMPLETED");
    assert.equal(finalBatch.succeededCount, 1);

    const notifications = await database.notification.count({
      where: { userId: state.attendeeUserId, kind: "CERTIFICATE", metadata: { path: ["batchId"], equals: state.batchCId } },
    });
    assert.equal(notifications, 1);
  });

  test("关闭通知时不创建站内通知", async (t) => {
    skipUnlessReady(t);
    if (!(await ensureAdminLoggedIn(t))) return;
    if (!state.templateId) {
      t.skip("缺少测试模板");
      return;
    }

    const quietRecipient = `batch-quiet-${suffix}@example.com`;
    const created = await adminClient.post("/api/admin/certificates/batches", {
      idempotencyKey: randomUUID(),
      templateId: state.templateId,
      source: "MANUAL_LIST",
      recipients: quietRecipient,
      notify: false,
    });
    assert.equal(created.status, 201, `创建静默批次失败: ${JSON.stringify(created.data)}`);
    const batchId = (created.data as { batch: { id: string } }).batch.id;

    const finalBatch = await processBatchUntilTerminal(batchId);
    assert.equal(finalBatch.status, "COMPLETED");

    const database = await db();
    const recipient = await database.user.findUnique({ where: { email: quietRecipient } });
    assert.ok(recipient);
    const notifications = await database.notification.count({
      where: { userId: recipient!.id, kind: "CERTIFICATE", metadata: { path: ["batchId"], equals: batchId } },
    });
    assert.equal(notifications, 0, "notify=false 时不得创建站内通知");
  });
});
