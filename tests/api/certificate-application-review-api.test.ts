/**
 * API 集成测试：证书申请审核并发竞争与审计可靠性（CP-AUD-006 / CP-AUD-005）
 *
 * 覆盖（真实数据库 + 真实会话）：
 * - REQUEST_INFORMATION 与 REJECT 并发审核：compare-and-set 保证只有一个成功（200），
 *   另一个返回 409，且只产生一条最终状态事件、一组通知和一条关键审计
 * - 已裁决申请再次审核返回 409
 * - 审核失败路径不留下中间状态（最终状态与事件/通知/审计数量一致）
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const applicantClient = new ApiClient(baseURL);

const state: {
  definitionId?: string;
  applicationId?: string;
  applicantId?: string;
  decidedStatus?: string;
  decidedAction?: string;
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

describe("证书申请审核并发与审计（CP-AUD-006/005）", () => {
  test("准备：创建可申请定义并提交申请", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;

    const adminLogin = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(adminLogin.status, 200, `管理员登录失败: ${JSON.stringify(adminLogin.data)}`);

    // 使用专用申请人，避免在共享种子用户上留下开放申请影响其他用例。
    const client = await db();
    const applicantEmail = `review_conc_applicant_${suffix}@example.com`;
    const passwordHash = await hash("seeded-password", 10);
    await client.user.create({
      data: {
        email: applicantEmail,
        password: passwordHash,
        name: "Review Concurrency Applicant",
        role: "ATTENDEE",
        emailVerified: new Date(),
      },
    });
    const applicantLogin = await applicantClient.login(buildLoginPayload(locale, applicantEmail, "seeded-password"));
    assert.equal(applicantLogin.status, 200, `申请人登录失败: ${JSON.stringify(applicantLogin.data)}`);

    const categoryResponse = await adminClient.post("/api/admin/certificates/categories", {
      key: `review-conc-${suffix}`.slice(0, 60).toLowerCase(),
      name: `Review Concurrency Category ${suffix}`,
      nameEn: `Review Concurrency Category ${suffix}`,
      isActive: true,
      userRequestEnabled: true,
    });
    assert.ok([200, 201].includes(categoryResponse.status), `创建分类失败: ${JSON.stringify(categoryResponse.data)}`);
    const categoryId = ((categoryResponse.data as { category?: { id: string } }).category
      ?? categoryResponse.data as { id?: string }).id;
    assert.ok(categoryId, "应返回分类 id");

    const templateResponse = await adminClient.post("/api/admin/certificates/templates", {
      categoryId,
      name: `Review Concurrency Certificate ${suffix}`,
      nameEn: `Review Concurrency Certificate ${suffix}`,
      templateType: "ACHIEVEMENT",
      pageSize: "A4_LANDSCAPE",
      isActive: true,
      definitionName: `Review Concurrency Definition ${suffix}`,
      approvalMode: "auto",
    });
    assert.ok([200, 201].includes(templateResponse.status), `创建模板失败: ${JSON.stringify(templateResponse.data)}`);
    state.definitionId = (templateResponse.data as { definition?: { id: string } }).definition?.id;
    assert.ok(state.definitionId, "应返回定义 id");

    const createResponse = await applicantClient.post("/api/certificate-applications", {
      definitionId: state.definitionId,
      submit: true,
      idempotencyKey: randomUUID(),
    });
    assert.ok([200, 201].includes(createResponse.status), `创建申请失败: ${JSON.stringify(createResponse.data)}`);
    const application = (createResponse.data as { application?: { id: string; status: string } }).application;
    assert.ok(application?.id, "应返回申请 id");
    assert.equal(application.status, "SUBMITTED");
    state.applicationId = application.id;

    const applicant = await client.user.findUnique({ where: { email: applicantEmail }, select: { id: true } });
    state.applicantId = applicant?.id;
  });

  test("并发 REQUEST_INFORMATION 与 REJECT 只有一个成功，且只产生一条事件、通知和审计", async (t) => {
    skipUnlessReady(t);
    const path = `/api/admin/certificate-applications/${state.applicationId}/review`;

    const [informationResponse, rejectResponse] = await Promise.all([
      adminClient.post(path, { action: "REQUEST_INFORMATION", message: "Please provide your attendance proof." }),
      adminClient.post(path, { action: "REJECT", message: "This credential is not available for your profile." }),
    ]);
    const statuses = [informationResponse.status, rejectResponse.status].sort();
    assert.deepEqual(statuses, [200, 409], `并发审核应一胜一负: ${JSON.stringify({ informationResponse: informationResponse.data, rejectResponse: rejectResponse.data })}`);

    const winner = informationResponse.status === 200 ? "REQUEST_INFORMATION" : "REJECT";
    state.decidedAction = winner;
    state.decidedStatus = winner === "REQUEST_INFORMATION" ? "NEEDS_INFORMATION" : "REJECTED";

    const client = await db();
    const application = await client.certificateApplication.findUniqueOrThrow({ where: { id: state.applicationId } });
    assert.equal(application.status, state.decidedStatus, "最终状态必须属于胜方动作");

    const events = await client.certificateApplicationEvent.findMany({
      where: { applicationId: state.applicationId, kind: { in: ["REQUEST_INFORMATION", "REJECT"] } },
    });
    assert.equal(events.length, 1, "并发竞争只允许一条最终状态事件");
    assert.equal(events[0].kind, winner);
    assert.equal(events[0].toStatus, state.decidedStatus);

    const notifications = await client.notification.findMany({
      where: { userId: state.applicantId, metadata: { path: ["applicationId"], equals: state.applicationId } },
    });
    assert.equal(notifications.length, 1, "并发竞争只允许一组通知");

    const audits = await client.coreAuditLog.findMany({
      where: {
        subjectType: "certificate_application",
        subjectId: state.applicationId,
        action: { in: ["certificate_application.request_information", "certificate_application.reject"] },
      },
    });
    assert.equal(audits.length, 1, "并发竞争只允许一条关键审计");
    assert.equal(audits[0].result, state.decidedStatus.toLowerCase());
    assert.equal(audits[0].actorUserId !== null, true);
  });

  test("已裁决申请再次审核返回 409", async (t) => {
    skipUnlessReady(t);
    const otherAction = state.decidedAction === "REQUEST_INFORMATION"
      ? { action: "REJECT", message: "Changed mind: not eligible." }
      : { action: "REQUEST_INFORMATION", message: "Changed mind: need more information." };
    const response = await adminClient.post(`/api/admin/certificate-applications/${state.applicationId}/review`, otherAction);
    assert.equal(response.status, 409);

    const client = await db();
    const events = await client.certificateApplicationEvent.findMany({
      where: { applicationId: state.applicationId, kind: { in: ["REQUEST_INFORMATION", "REJECT"] } },
    });
    assert.equal(events.length, 1, "失败审核不得追加事件");
  });

  test("收尾：撤销 NEEDS_INFORMATION 申请，避免测试库遗留开放申请", async (t) => {
    skipUnlessReady(t);
    if (state.decidedStatus !== "NEEDS_INFORMATION") {
      t.skip("终态为 REJECTED，无需撤销");
      return;
    }
    const response = await applicantClient.post(`/api/certificate-applications/${state.applicationId}/withdraw`, {});
    assert.equal(response.status, 200);
    const client = await db();
    const application = await client.certificateApplication.findUniqueOrThrow({ where: { id: state.applicationId } });
    assert.equal(application.status, "WITHDRAWN");
  });
});
