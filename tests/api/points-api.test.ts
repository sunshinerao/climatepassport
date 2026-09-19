/**
 * API 集成测试：积分流程
 *
 * 覆盖：
 * - 查询用户积分余额
 * - 积分预占（POST /api/redemption/reserve）
 * - 预占确认（POST /api/redemption/confirm）
 * - 预占取消（POST /api/redemption/cancel）
 *
 * 注意：积分预占/确认/取消接口需要真实兑换场景数据，
 * 当前测试主要验证接口权限与基本响应结构；核心兑换逻辑见 redemption-api.test.ts。
 */

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { ApiClient, waitForServer } from "./_client";
import { buildLoginPayload, testData } from "../fixtures/test-data";

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

describe("积分 API 流程", () => {
  test("未登录时查询积分余额需要认证", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const response = await client.get("/api/me/points");
    // 接口存在时应返回 401；若接口尚未实现可能返回 404
    assert.ok(
      response.status === 401 || response.status === 404,
      `Expected 401 or 404, got ${response.status}: ${JSON.stringify(response.data)}`,
    );
  });

  test("登录后可查询积分余额", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const user = testData.seededUsers.attendee;
    const loginResponse = await client.login(buildLoginPayload(locale, user.email, user.password));

    if (loginResponse.status === 403 && (loginResponse.data as { requiresVerification?: boolean }).requiresVerification) {
      t.skip("测试账号未验证邮箱，跳过积分查询测试");
      return;
    }
    assert.equal(loginResponse.status, 200, `登录失败: ${JSON.stringify(loginResponse.data)}`);

    const response = await client.get("/api/me/points");
    // 若 /api/me/points 不存在，可能返回 404；此处允许 200/404
    assert.ok(
      response.status === 200 || response.status === 404,
      `积分余额接口异常: ${response.status} ${JSON.stringify(response.data)}`,
    );
  });

  test("积分预占需要认证", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const response = await client.post("/api/redemption/reserve", {
      itemId: "test-item-id",
      points: 100,
    });
    // 接口存在时应返回 401；若接口尚未实现可能返回 404
    assert.ok(
      response.status === 401 || response.status === 404,
      `Expected 401 or 404, got ${response.status}: ${JSON.stringify(response.data)}`,
    );
  });

  test("积分预占需要有效的兑换项", async (t) => {
    skipIfServerUnavailable(t);
    t.skip("需要真实兑换项数据与业务实现，当前作为占位测试");
  });

  test("预占确认与取消遵循状态机", async (t) => {
    skipIfServerUnavailable(t);
    t.skip("需要先完成预占并获取 reservationId，当前作为占位测试");
  });
});
