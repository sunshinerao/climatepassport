/**
 * API 集成测试：证书公开验证资源级授权与审计脱敏（CP-AUD-001 / CP-AUD-002）
 *
 * 覆盖（真实数据库 + 真实会话，六角色负向矩阵）：
 * - 匿名 / 持有者 / 相关 EVENT_MANAGER（活动组织者）/ 无关 EVENT_MANAGER
 *   / 已分配 VERIFIER / 未分配 VERIFIER / ADMIN 的扩展字段披露矩阵
 * - 角色名称本身不构成授权；ADMIN 依 CP-FR-051 不在公开验证端点获得扩展正文
 * - 审计日志：有效证书只存 CertificateIssue.id；preview / not-found 只存截断指纹
 * - 审计 payload 断言不含原始 verification code
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
const verificationCode = `CV-AUTH-${suffix}`.toUpperCase();
const missingCode = `CV-MISSING-${suffix}`.toUpperCase();
const runStartedAt = new Date();

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const holderClient = new ApiClient(baseURL);
const relatedEmClient = new ApiClient(baseURL);
const unrelatedEmClient = new ApiClient(baseURL);
const assignedVerifierClient = new ApiClient(baseURL);
const unassignedVerifierClient = new ApiClient(baseURL);
const adminViewerClient = new ApiClient(baseURL);
const anonymousClient = new ApiClient(baseURL);

const state: {
  categoryId?: string;
  templateId?: string;
  definitionId?: string;
  activityId?: string;
  batchId?: string;
  itemId?: string;
  issueId?: string;
  holderEmail?: string;
  relatedEmId?: string;
  unrelatedEmEmail?: string;
  unassignedVerifierEmail?: string;
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

async function loginSeeded(client: ApiClient, email: string, t: { skip: (reason: string) => void }) {
  const response = await client.login(buildLoginPayload(locale, email, "seeded-password"));
  if (response.status === 403 && (response.data as { requiresVerification?: boolean }).requiresVerification) {
    t.skip("种子账号未验证邮箱，跳过证书验证授权测试");
    return false;
  }
  assert.equal(response.status, 200, `登录失败 (${email}): ${JSON.stringify(response.data)}`);
  return true;
}

async function auditLogsThisRun() {
  const client = await db();
  return client.coreAuditLog.findMany({
    where: { action: "certificate.verify.query", createdAt: { gte: runStartedAt } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

function assertNoRawCodeInAuditLogs(logs: Array<{ subjectId: string | null; metadataJson: unknown }>) {
  for (const log of logs) {
    const metadata = (log.metadataJson ?? {}) as Record<string, unknown>;
    assert.equal(metadata.verificationCode, undefined, "审计 metadata 不得包含原始 verification code");
    assert.notEqual(log.subjectId, verificationCode, "审计 subjectId 不得为原始 code");
    assert.notEqual(log.subjectId, missingCode, "审计 subjectId 不得为原始 code");
    assert.notEqual(log.subjectId, "CV-PREVIEW", "审计 subjectId 不得为原始 preview code");
  }
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("证书公开验证资源级授权与审计脱敏（CP-AUD-001/002）", () => {
  test("准备：创建证书定义、活动来源、批次关联与六角色账号", async (t) => {
    skipUnlessReady(t);

    const client = await db();
    const seeded = testData.seededUsers;
    const admin = await client.user.findUnique({ where: { email: seeded.admin.email } });
    const holder = await client.user.findUnique({ where: { email: seeded.attendee.email } });
    const relatedEm = await client.user.findUnique({ where: { email: seeded.eventManager.email } });
    const assignedVerifier = await client.user.findUnique({ where: { email: seeded.verifier.email } });
    assert.ok(admin && holder && relatedEm && assignedVerifier, "种子用户必须存在");

    const passwordHash = await hash("seeded-password", 10);
    const unrelatedEmEmail = `verifauth_em_unrelated_${suffix}@example.com`;
    const unassignedVerifierEmail = `verifauth_verifier_unassigned_${suffix}@example.com`;
    await client.user.create({
      data: {
        email: unrelatedEmEmail,
        password: passwordHash,
        name: "Unrelated EM (verify-auth)",
        role: "EVENT_MANAGER",
        emailVerified: new Date(),
      },
    });
    await client.user.create({
      data: {
        email: unassignedVerifierEmail,
        password: passwordHash,
        name: "Unassigned Verifier (verify-auth)",
        role: "VERIFIER",
        emailVerified: new Date(),
      },
    });

    assert.ok(await loginSeeded(adminClient, seeded.admin.email, t));
    assert.ok(await loginSeeded(holderClient, seeded.attendee.email, t));
    assert.ok(await loginSeeded(relatedEmClient, seeded.eventManager.email, t));
    assert.ok(await loginSeeded(unrelatedEmClient, unrelatedEmEmail, t));
    assert.ok(await loginSeeded(assignedVerifierClient, seeded.verifier.email, t));
    assert.ok(await loginSeeded(unassignedVerifierClient, unassignedVerifierEmail, t));
    assert.ok(await loginSeeded(adminViewerClient, seeded.admin.email, t));

    const categoryResponse = await adminClient.post("/api/admin/certificates/categories", {
      key: `verify-auth-${suffix}`.slice(0, 60).toLowerCase(),
      name: `Verify Auth Category ${suffix}`,
      nameEn: `Verify Auth Category ${suffix}`,
      isActive: true,
    });
    assert.ok([200, 201].includes(categoryResponse.status), `创建分类失败: ${JSON.stringify(categoryResponse.data)}`);
    const categoryId = ((categoryResponse.data as { category?: { id: string } }).category
      ?? categoryResponse.data as { id?: string }).id;
    assert.ok(categoryId, "应返回分类 id");

    const templateResponse = await adminClient.post("/api/admin/certificates/templates", {
      categoryId,
      name: `Verify Auth Certificate ${suffix}`,
      nameEn: `Verify Auth Certificate ${suffix}`,
      templateType: "ACHIEVEMENT",
      pageSize: "A4_LANDSCAPE",
      isActive: true,
      definitionName: `Verify Auth Definition ${suffix}`,
      approvalMode: "auto",
    });
    assert.ok([200, 201].includes(templateResponse.status), `创建模板失败: ${JSON.stringify(templateResponse.data)}`);
    const templateData = templateResponse.data as { template?: { id: string }; definition?: { id: string } };
    state.categoryId = categoryId;
    state.templateId = templateData.template?.id;
    state.definitionId = templateData.definition?.id;
    assert.ok(state.templateId && state.definitionId, "应返回模板与定义 id");

    const activity = await client.activity.create({
      data: {
        type: "EVENT",
        title: `Verify Auth Activity ${suffix}`,
        slug: `verify-auth-${suffix}`.toLowerCase(),
        status: "PUBLISHED",
        language: "en",
        createdByUserId: admin.id,
        organizerUserId: relatedEm.id,
      },
      select: { id: true },
    });
    state.activityId = activity.id;
    state.holderEmail = holder.email;
    state.relatedEmId = relatedEm.id;
    state.unrelatedEmEmail = unrelatedEmEmail;
    state.unassignedVerifierEmail = unassignedVerifierEmail;

    await client.activityVerifier.create({ data: { userId: assignedVerifier.id, activityId: activity.id } });

    const batch = await client.certificateBatch.create({
      data: {
        idempotencyKey: `verify-auth-${suffix}`,
        source: "MANUAL_LIST",
        status: "COMPLETED",
        templateId: state.templateId,
        definitionId: state.definitionId,
        activityId: activity.id,
        issueDate: new Date(),
        createdByUserId: admin.id,
        totalCount: 1,
        succeededCount: 1,
        notifyRecipients: false,
      },
      select: { id: true },
    });
    state.batchId = batch.id;

    const item = await client.certificateBatchItem.create({
      data: {
        batchId: batch.id,
        rowIndex: 0,
        email: holder.email,
        normalizedEmail: holder.email.toLowerCase(),
        status: "SUCCEEDED",
      },
      select: { id: true },
    });
    state.itemId = item.id;

    const issue = await client.certificateIssue.create({
      data: {
        definitionId: state.definitionId,
        userId: holder.id,
        sourceType: "CERTIFICATE_BATCH",
        sourceId: `certificate-batch-item:${item.id}`,
        status: "ISSUED",
        verificationCode,
        publicVisible: true,
        variableValuesJson: { issuerName: "Climate Passport Test Issuer" },
        issuedAt: new Date(),
      },
      select: { id: true },
    });
    state.issueId = issue.id;
    await client.certificateBatchItem.update({ where: { id: item.id }, data: { certificateIssueId: issue.id } });
  });

  test("匿名验证者仅获得公开白名单字段", async (t) => {
    skipUnlessReady(t);
    const response = await anonymousClient.get(`/api/certificates/verify/${verificationCode}`);
    assert.equal(response.status, 200, `匿名验证失败: ${JSON.stringify(response.data)}`);
    const data = response.data as { accessLevel: string; certificate?: { extended?: unknown; viewer?: { canViewExtendedFields: boolean } } };
    assert.equal(data.accessLevel, "PUBLIC");
    assert.equal(data.certificate?.extended, undefined);
    assert.equal(data.certificate?.viewer?.canViewExtendedFields, false);
  });

  test("持有者获得 HOLDER 级别与扩展字段", async (t) => {
    skipUnlessReady(t);
    const response = await holderClient.get(`/api/certificates/verify/${verificationCode}`);
    assert.equal(response.status, 200);
    const data = response.data as {
      accessLevel: string;
      certificate?: { extended?: { issueId: string; holderEmail: string | null; sourceId: string | null } };
    };
    assert.equal(data.accessLevel, "HOLDER");
    assert.equal(data.certificate?.extended?.issueId, state.issueId);
    assert.equal(data.certificate?.extended?.holderEmail, state.holderEmail);
  });

  test("相关 EVENT_MANAGER（来源活动组织者）获得 STAFF 扩展字段", async (t) => {
    skipUnlessReady(t);
    const response = await relatedEmClient.get(`/api/certificates/verify/${verificationCode}`);
    assert.equal(response.status, 200);
    const data = response.data as {
      accessLevel: string;
      certificate?: { extended?: { issueId: string; sourceId: string | null; holderEmail: string | null } };
    };
    assert.equal(data.accessLevel, "STAFF");
    assert.equal(data.certificate?.extended?.issueId, state.issueId);
    assert.equal(data.certificate?.extended?.sourceId, `certificate-batch-item:${state.itemId}`);
    assert.equal(data.certificate?.extended?.holderEmail, state.holderEmail);
  });

  test("无关 EVENT_MANAGER 仅获得公开字段", async (t) => {
    skipUnlessReady(t);
    const response = await unrelatedEmClient.get(`/api/certificates/verify/${verificationCode}`);
    assert.equal(response.status, 200);
    const data = response.data as { accessLevel: string; certificate?: { extended?: unknown } };
    assert.equal(data.accessLevel, "PUBLIC", "无关 EVENT_MANAGER 不得因角色获得扩展字段");
    assert.equal(data.certificate?.extended, undefined);
  });

  test("已分配 VERIFIER 不因角色获得证书后台扩展数据", async (t) => {
    skipUnlessReady(t);
    const response = await assignedVerifierClient.get(`/api/certificates/verify/${verificationCode}`);
    assert.equal(response.status, 200);
    const data = response.data as { accessLevel: string; certificate?: { extended?: unknown } };
    assert.equal(data.accessLevel, "PUBLIC", "VERIFIER 仅应获得当前核验动作必要字段（公开白名单）");
    assert.equal(data.certificate?.extended, undefined);
  });

  test("未分配 VERIFIER 仅获得公开字段", async (t) => {
    skipUnlessReady(t);
    const response = await unassignedVerifierClient.get(`/api/certificates/verify/${verificationCode}`);
    assert.equal(response.status, 200);
    const data = response.data as { accessLevel: string; certificate?: { extended?: unknown } };
    assert.equal(data.accessLevel, "PUBLIC");
    assert.equal(data.certificate?.extended, undefined);
  });

  test("ADMIN 依 CP-FR-051 在公开验证端点不获得扩展正文", async (t) => {
    skipUnlessReady(t);
    const response = await adminViewerClient.get(`/api/certificates/verify/${verificationCode}`);
    assert.equal(response.status, 200);
    const data = response.data as { accessLevel: string; certificate?: { extended?: unknown } };
    assert.equal(data.accessLevel, "PUBLIC", "ADMIN 技术运维无常态正文浏览权限，管理职责走后台审计路径");
    assert.equal(data.certificate?.extended, undefined);
  });

  test("not-found 与 preview 查询审计只保存截断指纹", async (t) => {
    skipUnlessReady(t);

    const notFoundResponse = await anonymousClient.get(`/api/certificates/verify/${missingCode}`);
    assert.equal(notFoundResponse.status, 404);
    const previewResponse = await anonymousClient.get("/api/certificates/verify/CV-PREVIEW");
    assert.equal(previewResponse.status, 200);
    assert.equal((previewResponse.data as { result: string }).result, "PREVIEW");

    const client = await db();
    const notFoundLog = await client.coreAuditLog.findFirst({
      where: { action: "certificate.verify.query", result: "not_found", subjectType: "certificate_verification_code" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(notFoundLog, "应存在 not-found 审计记录");
    assert.match(notFoundLog.subjectId ?? "", /^fp:[0-9a-f]{16}$/);
    assert.equal(notFoundLog.subjectId, notFoundLog.subjectId?.toLowerCase());

    const previewLog = await client.coreAuditLog.findFirst({
      where: { action: "certificate.verify.query", result: "preview", subjectType: "certificate_verification_code" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(previewLog, "应存在 preview 审计记录");
    assert.match(previewLog.subjectId ?? "", /^fp:[0-9a-f]{16}$/);
    assert.notEqual(previewLog.subjectId, "CV-PREVIEW");
  });

  test("有效证书审计只存 CertificateIssue.id，本次运行审计不含原始 code", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const foundLogs = await client.coreAuditLog.findMany({
      where: {
        action: "certificate.verify.query",
        subjectType: "certificate_issue",
        subjectId: state.issueId,
        createdAt: { gte: runStartedAt },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    assert.ok(foundLogs.length >= 7, "六角色矩阵查询应各产生一条有效证书审计");
    for (const log of foundLogs) {
      assert.equal(log.subjectId, state.issueId, "有效证书审计 subjectId 必须是 CertificateIssue.id");
      const metadata = (log.metadataJson ?? {}) as Record<string, unknown>;
      assert.equal(metadata.verificationCode, undefined, "有效证书审计 metadata 不得包含原始 code");
    }

    const runLogs = await auditLogsThisRun();
    assertNoRawCodeInAuditLogs(runLogs);
  });
});
