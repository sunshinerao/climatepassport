/**
 * API 集成测试：渠道机器客户端认证与登记（CP-TODO-243 / CP-FR-069）
 *
 * 覆盖（真实数据库 + 真实 HTTP 头）：
 * - ADMIN 登记 MACHINE 客户端（machine key 仅创建响应出现一次，列表不泄漏 secret 材料）
 * - /api/v1/channel/certificates/verify 机器认证分支：正确凭据 → 进入业务（404
 *   NOT_FOUND 即认证通过）；未知客户端/错误密钥 401 CHANNEL_MACHINE_AUTH_FAILED；
 *   scope 被移除 403 CHANNEL_SCOPE_DENIED；带 Origin 未命中白名单 403
 *   CHANNEL_ORIGIN_DENIED；无 Origin 的服务端调用按 allowedIps 判，白名单非空却
 *   不可归因 403 CHANNEL_IP_DENIED；撤销后立即 401
 * - 无凭据请求保持旧有 SHCW 环境门行为（测试环境 SHCW 关闭 → 403 CHANNEL_DISABLED）
 * - 登记/更新/撤销审计落库
 * - 清单分页：page/pageSize/total、服务端 type 与关键词筛选、越界空页、非法参数 400
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { ApiClient, waitForServer } from "./_client";
import { buildLoginPayload, testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3100";
const locale = testData.locale;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const runStartedAt = new Date();
const clientKey = `FSV1${suffix.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}`.slice(0, 15);
const machineKey = `cpmk_test_channel_${suffix}`;
const verifyPath = "/api/v1/channel/certificates/verify/CV-NOPE-12345";

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const machineClient = new ApiClient(baseURL);

const state: {
  programmeId?: string;
  clientDbId?: string;
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

function machineHeaders(key: string, secret: string, origin?: string, extra?: Record<string, string>) {
  return {
    "X-Channel-Client-Key": key,
    "X-Channel-Machine-Key": secret,
    ...(origin ? { Origin: origin } : {}),
    ...(extra ?? {}),
  };
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("渠道机器客户端认证（CP-TODO-243）", () => {
  test("准备：登记 MACHINE 客户端（machine key 只出现一次）", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    const login = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(login.status, 200, `管理员登录失败: ${JSON.stringify(login.data)}`);

    const client = await db();
    const tenant = await client.tenant.create({
      data: { key: `ch-tenant-${suffix}`, name: `Channel Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = await client.programme.create({
      data: { key: `ch-prog-${suffix}`, name: `Channel Programme ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });
    state.programmeId = programme.id;

    const register = await adminClient.post("/api/admin/channel-clients", {
      key: clientKey,
      displayName: `FS Machine ${suffix}`,
      type: "MACHINE",
      programmeId: programme.id,
      allowedOrigins: ["https://fs.example"],
      allowedScopes: ["channel:certificates:verify"],
      machineKey,
    });
    assert.equal(register.status, 201, `登记客户端失败: ${JSON.stringify(register.data)}`);
    const body = register.data as { client: { id: string; key: string }; machineKey?: string; warning?: string };
    assert.equal(body.client.key, clientKey);
    assert.equal(body.machineKey, machineKey, "提供 machineKey 时原样回显");
    assert.ok(body.warning, "应提示一次性保存 machine key");
    state.clientDbId = body.client.id;

    const list = await adminClient.get(`/api/admin/channel-clients?programmeId=${programme.id}`);
    assert.equal(list.status, 200);
    const listed = (list.data as { clients: Array<Record<string, unknown>> }).clients.find((entry) => entry.key === clientKey);
    assert.ok(listed, "列表应包含新客户端");
    assert.equal(listed.machineKeyConfigured, true);
    const listedRaw = JSON.stringify(list.data);
    assert.equal(listedRaw.includes(machineKey), false, "machine key 明文不得出现在列表中");
    assert.equal(listedRaw.includes("machineKeyHash"), false, "machine key 摘要字段名不得出现在列表中");
  });

  test("机器认证：错误凭据与来源矩阵", async (t) => {
    skipUnlessReady(t);

    const unknown = await machineClient.get(verifyPath, machineHeaders("FSV1UNKNOWN", machineKey, "https://fs.example"));
    assert.equal(unknown.status, 401);
    assert.equal((unknown.data as { error: { code: string } }).error.code, "CHANNEL_MACHINE_AUTH_FAILED");

    const wrongKey = await machineClient.get(verifyPath, machineHeaders(clientKey, "wrong-key", "https://fs.example"));
    assert.equal(wrongKey.status, 401);
    assert.equal((wrongKey.data as { error: { code: string } }).error.code, "CHANNEL_MACHINE_AUTH_FAILED");

    const wrongOrigin = await machineClient.get(verifyPath, machineHeaders(clientKey, machineKey, "https://evil.example"));
    assert.equal(wrongOrigin.status, 403);
    assert.equal((wrongOrigin.data as { error: { code: string } }).error.code, "CHANNEL_ORIGIN_DENIED");

    // 带 Origin 即视为浏览器调用，必须命中白名单；不带 Origin 是服务端到服务端，
    // 未配 IP 白名单时不受来源限制——强制 origin 不该把后台集成方挡在门外。
    const serverToServer = await machineClient.get(verifyPath, machineHeaders(clientKey, machineKey));
    assert.equal(serverToServer.status, 404, `无 Origin 应作为服务端调用放行: ${JSON.stringify(serverToServer.data)}`);

    const ipRestricted = await adminClient.patch(`/api/admin/channel-clients/${state.clientDbId}`, { allowedIps: ["198.51.100.0/24"] });
    assert.equal(ipRestricted.status, 200, `配置 IP 白名单失败: ${JSON.stringify(ipRestricted.data)}`);

    const unattributed = await machineClient.get(verifyPath, machineHeaders(clientKey, machineKey));
    assert.equal(unattributed.status, 403, "白名单非空却拿不到可归因地址时必须 fail closed");
    assert.equal((unattributed.data as { error: { code: string } }).error.code, "CHANNEL_IP_DENIED");

    const outOfRange = await machineClient.get(verifyPath, machineHeaders(clientKey, machineKey, undefined, { "x-real-ip": "203.0.113.5" }));
    assert.equal(outOfRange.status, 403);
    assert.equal((outOfRange.data as { error: { code: string } }).error.code, "CHANNEL_IP_DENIED");

    const inRange = await machineClient.get(verifyPath, machineHeaders(clientKey, machineKey, undefined, { "x-real-ip": "198.51.100.7" }));
    assert.equal(inRange.status, 404, `CIDR 内地址应进入业务: ${JSON.stringify(inRange.data)}`);

    // 两套口径各管一类调用方：带 Origin 的浏览器调用只按 allowedOrigins 判，
    // 命中即放行，不再叠加 IP 判定（IP 白名单约束的是无 Origin 的服务端调用）。
    const allowedOriginIgnoresIp = await machineClient.get(verifyPath, machineHeaders(clientKey, machineKey, "https://fs.example", { "x-real-ip": "203.0.113.5" }));
    assert.equal(allowedOriginIgnoresIp.status, 404, `Origin 命中即应放行: ${JSON.stringify(allowedOriginIgnoresIp.data)}`);

    const restoreIps = await adminClient.patch(`/api/admin/channel-clients/${state.clientDbId}`, { allowedIps: [] });
    assert.equal(restoreIps.status, 200);
  });

  test("机器认证：正确凭据进入业务（404 NOT_FOUND），scope 移除后 403，撤销后 401", async (t) => {
    skipUnlessReady(t);

    const ok = await machineClient.get(verifyPath, machineHeaders(clientKey, machineKey, "https://fs.example"));
    assert.equal(ok.status, 404, `认证通过应进入业务层（证书不存在故 404）: ${JSON.stringify(ok.data)}`);
    assert.equal((ok.data as { status?: string }).status, "NOT_FOUND");

    const stripScope = await adminClient.patch(`/api/admin/channel-clients/${state.clientDbId}`, {
      allowedScopes: ["channel:session:bridge"],
    });
    assert.equal(stripScope.status, 200, `更新 scopes 失败: ${JSON.stringify(stripScope.data)}`);
    const denied = await machineClient.get(verifyPath, machineHeaders(clientKey, machineKey, "https://fs.example"));
    assert.equal(denied.status, 403);
    assert.equal((denied.data as { error: { code: string } }).error.code, "CHANNEL_SCOPE_DENIED");

    const restore = await adminClient.patch(`/api/admin/channel-clients/${state.clientDbId}`, {
      allowedScopes: ["channel:certificates:verify"],
    });
    assert.equal(restore.status, 200);

    const revoke = await adminClient.post(`/api/admin/channel-clients/${state.clientDbId}/revoke`, { reason: "test rotation" });
    assert.equal(revoke.status, 200, `撤销失败: ${JSON.stringify(revoke.data)}`);
    const afterRevoke = await machineClient.get(verifyPath, machineHeaders(clientKey, machineKey, "https://fs.example"));
    assert.equal(afterRevoke.status, 401, "撤销后凭据必须立即失效");
    const secondRevoke = await adminClient.post(`/api/admin/channel-clients/${state.clientDbId}/revoke`, {});
    assert.equal(secondRevoke.status, 409);
  });

  test("无凭据请求保持旧有 SHCW 环境门行为", async (t) => {
    skipUnlessReady(t);
    const legacy = await machineClient.get(verifyPath);
    assert.equal(legacy.status, 403, "测试环境 CHANNEL_SHCW_ENABLED=false，无凭据走旧门应 403");
    assert.equal((legacy.data as { error: { code: string } }).error.code, "CHANNEL_DISABLED");
  });

  test("登记治理审计落库", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const audits = await client.coreAuditLog.findMany({
      where: {
        createdAt: { gte: runStartedAt },
        action: { in: ["channel_client.register", "channel_client.update", "channel_client.revoke"] },
      },
    });
    const actions = new Set(audits.map((audit) => audit.action));
    for (const action of ["channel_client.register", "channel_client.update", "channel_client.revoke"]) {
      assert.equal(actions.has(action), true, `缺少审计动作 ${action}`);
    }
  });

  test("清单分页：不重不漏、服务端筛选、越界空页与非法参数 400", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const tenant = await client.tenant.create({
      data: { key: `pg-tenant-${suffix}`, name: `Paging Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = await client.programme.create({
      data: { key: `pg-prog-${suffix}`, name: `Paging Programme ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });

    type Listed = { id: string; key: string; displayName: string; type: string };
    type ListBody = { clients: Listed[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
    const list = async (query: string) => {
      const response = await adminClient.get(`/api/admin/channel-clients?programmeId=${programme.id}&${query}`);
      return { status: response.status, body: response.data as ListBody & { error?: string } };
    };

    const expected: { key: string; type: string }[] = [];
    for (let index = 0; index < 7; index += 1) {
      const type = index % 2 === 0 ? "MACHINE" : "USER_FACING";
      const register = await adminClient.post("/api/admin/channel-clients", {
        displayName: `Paging ${String(index).padStart(2, "0")} ${suffix}`,
        type,
        programmeId: programme.id,
        allowedScopes: ["channel:source:resolve"],
      });
      assert.equal(register.status, 201, `登记失败: ${JSON.stringify(register.data)}`);
      expected.push({ key: (register.data as { client: { key: string } }).client.key, type });
    }

    try {
      const first = await list("pageSize=3");
      assert.equal(first.status, 200);
      assert.deepEqual(first.body.pagination, { page: 1, pageSize: 3, total: 7, totalPages: 3 }, "total 是全量匹配数，不是本页行数");
      assert.equal(first.body.clients.length, 3);

      const second = await list("pageSize=3&page=2");
      const third = await list("pageSize=3&page=3");
      const paged = [...first.body.clients, ...second.body.clients, ...third.body.clients];
      assert.equal(paged.length, 7, "三页拼回全量");
      assert.equal(new Set(paged.map((row) => row.id)).size, 7, "翻页不得重复同一行");
      assert.deepEqual(
        paged.map((row) => row.key).sort(),
        expected.map((row) => row.key).sort(),
        "翻页也不得漏行",
      );

      const machines = await list("type=MACHINE");
      assert.equal(machines.body.pagination.total, 4, "type 筛选发生在服务端");
      assert.ok(machines.body.clients.every((row) => row.type === "MACHINE"));

      const searched = await list(`type=MACHINE&pageSize=50&search=${encodeURIComponent("paging 0")}`);
      assert.deepEqual(
        searched.body.clients.map((row) => row.displayName).sort(),
        [0, 2, 4, 6].map((index) => `Paging ${String(index).padStart(2, "0")} ${suffix}`),
        "关键词大小写不敏感，且与 type 叠加",
      );

      const oddRows = await list(`type=MACHINE&search=${encodeURIComponent(`paging 01 ${suffix}`)}`);
      assert.deepEqual(oddRows.body.clients, [], "命中行不满足 type 时应为空，而不是忽略筛选");

      const byKey = await list(`search=${encodeURIComponent(expected[0].key)}`);
      assert.equal(byKey.body.clients.length, 1, "client key 同样是搜索项");

      const beyond = await list("pageSize=3&page=99");
      assert.equal(beyond.status, 200, "越界页是空集，不是 404");
      assert.deepEqual(beyond.body.clients, []);
      assert.equal(beyond.body.pagination.total, 7, "空页仍带回真实总数");

      const noDigest = JSON.stringify(first.body);
      assert.equal(noDigest.includes("machineKeyHash"), false);
      assert.equal(noDigest.includes("machineKeyBcrypt"), false);
      assert.equal(noDigest.includes("$2"), false, "分页后每一页都不得夹带密钥材料");

      const badPage = await list("page=0");
      assert.equal(badPage.status, 400, "page=0 应 400");
      const badSize = await list("pageSize=0");
      assert.equal(badSize.status, 400, "pageSize=0 应 400");
      const bigSize = await list("pageSize=101");
      assert.equal(bigSize.status, 400, "超出上限的 pageSize 应 400，不能被静默放大");
      const badProgramme = await adminClient.get("/api/admin/channel-clients?programmeId=not-a-uuid");
      assert.equal(badProgramme.status, 400, "非法 programmeId 应 400");
      const badType = await list("type=NOPE");
      assert.equal(badType.status, 400, "未知 type 应 400 而不是静默返回全量");
      const longSearch = await list(`search=${"x".repeat(121)}`);
      assert.equal(longSearch.status, 400, "超长关键词应在查库前拒掉");
    } finally {
      await client.channelClient.deleteMany({ where: { programmeId: programme.id } });
      await client.programme.delete({ where: { id: programme.id } });
      await client.tenant.delete({ where: { id: tenant.id } });
    }
  });
});
