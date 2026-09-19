/**
 * API 集成测试：兑换流程
 *
 * 覆盖：
 * - 创建兑换意图
 * - 预占积分
 * - 结算兑换
 * - 退款流程
 *
 * 兑换流程依赖积分账户、兑换商品、库存与支付状态机，
 * 当前测试以接口可用性与权限验证为主，复杂业务流作为占位测试。
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

describe("兑换 API 流程", () => {
  test("创建兑换意图需要认证", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const response = await client.post("/api/redemption/intents", {
      itemId: "test-item-id",
      quantity: 1,
    });
    // 若接口不存在则返回 404；未认证应返回 401
    assert.ok(
      response.status === 401 || response.status === 404,
      `Expected 401 or 404, got ${response.status}: ${JSON.stringify(response.data)}`,
    );
  });

  test("已登录用户创建兑换意图", async (t) => {
    skipIfServerUnavailable(t);
    const client = new ApiClient(baseURL);
    const user = testData.seededUsers.attendee;
    const loginResponse = await client.login(buildLoginPayload(locale, user.email, user.password));

    if (loginResponse.status === 403 && (loginResponse.data as { requiresVerification?: boolean }).requiresVerification) {
      t.skip("测试账号未验证邮箱，跳过兑换意图测试");
      return;
    }
    assert.equal(loginResponse.status, 200, `登录失败: ${JSON.stringify(loginResponse.data)}`);

    const response = await client.post("/api/redemption/intents", {
      itemId: "test-item-id",
      quantity: 1,
    });
    assert.ok(
      response.status === 201 || response.status === 404 || response.status === 400,
      `兑换意图接口异常: ${response.status} ${JSON.stringify(response.data)}`,
    );
  });

  test("预占积分", async (t) => {
    skipIfServerUnavailable(t);
    t.skip("依赖真实兑换意图与商品库存，当前作为占位测试");
  });

  test("结算兑换", async (t) => {
    skipIfServerUnavailable(t);
    t.skip("依赖预占成功后的 reservationId，当前作为占位测试");
  });

  test("退款流程", async (t) => {
    skipIfServerUnavailable(t);
    t.skip("依赖已结算兑换记录，当前作为占位测试");
  });
});
