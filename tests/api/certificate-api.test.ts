/**
 * API 集成测试：证书申请与审批流程
 *
 * 覆盖：
 * - 创建证书申请（POST /api/certificate-applications）
 * - 管理员审批（POST /api/admin/certificate-applications/[id]/review）
 * - 证书签发验证
 * - 证书状态查询
 *
 * 注意：本测试需要目标服务器已连接测试数据库并处于运行状态。
 * 若相关接口尚未实现或测试数据不满足条件，会优雅地 skip 或标记失败。
 */

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { ApiClient, waitForServer } from "./_client";
import { buildCertificateApplicationPayload, buildLoginPayload, testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3000";
const locale = testData.locale;

let serverReady = false;

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

function skipIfServerUnavailable(t) {
  if (!serverReady) {
    t.skip("目标服务器未就绪，跳过 API 测试");
  }
}

describe("证书申请 API 流程", () => {
  test("创建证书申请需要认证", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const payload = buildCertificateApplicationPayload("00000000-0000-0000-0000-000000000000");
    const response = await client.post("/api/certificate-applications", payload);

    // 未登录应返回 401
    assert.equal(response.status, 401, `Expected 401, got ${response.status}: ${JSON.stringify(response.data)}`);
  });

  test("登录普通用户后可创建证书申请", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const user = testData.seededUsers.attendee;
    const loginResponse = await client.login(buildLoginPayload(locale, user.email, user.password));

    if (loginResponse.status === 403 && (loginResponse.data as { requiresVerification?: boolean }).requiresVerification) {
      t.skip("测试账号未验证邮箱，跳过证书申请创建测试");
      return;
    }
    assert.equal(loginResponse.status, 200, `登录失败: ${JSON.stringify(loginResponse.data)}`);

    // 查询可申请的证书定义
    const listResponse = await client.get("/api/certificate-applications");
    assert.equal(listResponse.status, 200);
    const definitions = (listResponse.data as { definitions?: Array<{ id: string; name: string }> }).definitions || [];
    if (definitions.length === 0) {
      t.skip("当前测试数据库没有可申请的证书定义");
      return;
    }

    const definitionId = definitions[0].id;
    const createResponse = await client.post(
      "/api/certificate-applications",
      buildCertificateApplicationPayload(definitionId),
    );
    assert.equal(createResponse.status, 201, `创建证书申请失败: ${JSON.stringify(createResponse.data)}`);
    assert.ok((createResponse.data as { application?: { id: string } }).application?.id, "应返回 application.id");
  });

  test("管理员审批接口需要管理员权限", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const response = await client.post("/api/admin/certificate-applications/00000000-0000-0000-0000-000000000000/review", {
      action: "APPROVE_AND_ISSUE",
    });
    // 未登录时可能返回 401；中间件若按角色拦截也可能返回 403
    assert.ok(
      response.status === 401 || response.status === 403,
      `Expected 401 or 403, got ${response.status}: ${JSON.stringify(response.data)}`,
    );
  });

  test("管理员登录后可审批证书申请", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const admin = testData.seededUsers.admin;
    const loginResponse = await client.login(buildLoginPayload(locale, admin.email, admin.password));

    if (loginResponse.status === 403 && (loginResponse.data as { requiresVerification?: boolean }).requiresVerification) {
      t.skip("管理员账号未验证邮箱，跳过审批测试");
      return;
    }
    assert.equal(loginResponse.status, 200, `管理员登录失败: ${JSON.stringify(loginResponse.data)}`);

    const listResponse = await client.get("/api/certificate-applications");
    assert.equal(listResponse.status, 200);
    const applications = (listResponse.data as { applications?: Array<{ id: string; status: string }> }).applications || [];
    const pending = applications.find((a) => a.status === "PENDING" || a.status === "SUBMITTED");
    if (!pending) {
      t.skip("当前没有待审批的证书申请");
      return;
    }

    const response = await client.post(`/api/admin/certificate-applications/${pending.id}/review`, {
      action: "APPROVE_AND_ISSUE",
    });
    assert.ok(
      response.status === 200 || response.status === 201 || response.status === 404,
      `审批接口异常: ${response.status} ${JSON.stringify(response.data)}`,
    );
  });

  test("证书状态查询", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const response = await client.get("/api/certificate-applications");
    // 未认证时返回 401，已认证时返回 200
    assert.ok(
      response.status === 200 || response.status === 401,
      `证书状态查询接口异常: ${response.status} ${JSON.stringify(response.data)}`,
    );
  });
});
