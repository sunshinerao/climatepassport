/**
 * API 集成测试：Open API 的 API Key 控制模式
 *
 * 覆盖（真实数据库 + 真实 HTTP）：
 * - ADMIN 经 /api/admin/channel-clients 登记 MACHINE 客户端；机密明文与
 *   `<clientKey>.<machineKey>` 形态的 Open API 凭据只在创建响应里出现一次
 * - 登记校验：machineKey 必须以 `cpmk_` 开头且不超过 bcrypt 的 72 字节截断边界；
 *   配额两字段必须成对
 * - GET /api/v1/open/whoami：只回自己的身份/scope/配额/密钥元数据/访问约束，
 *   x-request-id 与响应体一致；不同 Programme 的 key 各自只见自己的 Programme；
 *   首次调用后 lastUsedAt 被写入
 * - 失败矩阵：无 Authorization → 401 API_KEY_MISSING；非 Bearer / 旧式裸机密（无
 *   clientKey 前缀）/ 未知客户端 / 密钥不符 / 超长 bearer → 401 API_KEY_INVALID；
 *   cookie 会话不能替代 API Key
 * - GET /api/v1/open/certificates/{code}：有效 key 进入业务（不存在的码 → 404
 *   NOT_FOUND 即鉴权通过）；未授予 scope 的 key → 403 API_KEY_SCOPE_DENIED；
 *   无凭据绝不退回公开路径
 * - 来源约束：带 Origin 即视为浏览器调用，必须命中 allowedOrigins（空列表一律
 *   403 API_KEY_ORIGIN_DENIED）；无 Origin 的服务端调用改看 allowedIps（CIDR），
 *   不可归因地址 + 非空白名单 → 403 API_KEY_IP_DENIED
 * - 配额：每把 key 的登记值覆盖端点默认；越限 → 429 RATE_LIMITED 且带 Retry-After；
 *   PATCH 改配即时生效，成对 null 回到默认
 * - 生命周期：machineKeyExpiresAt 过期 → 403 API_KEY_EXPIRED；轮换后旧 key 当场
 *   401、新 key 可用且 rotatedAt/expiresAt 重置；撤销 → 401 且 revokedAt/reason 落库
 * - 管理台列表不外泄任何摘要列
 * - 失败审计 openapi.access.denied 落库并带 requestId；任何审计行都不含 key 明文
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
const alphanumeric = suffix.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
const tail = suffix.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const missingCodePath = "/api/v1/open/certificates/CV-NOPE-OPENAPI-1";
const whoamiPath = "/api/v1/open/whoami";
const verifyScope = "channel:certificates:verify";
const otherScope = "channel:source:resolve";

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const openApiClient = new ApiClient(baseURL);
const otherKeyClient = new ApiClient(baseURL);
const browserClient = new ApiClient(baseURL);
const ipBoundClient = new ApiClient(baseURL);
const quotaClient = new ApiClient(baseURL);
const lifecycleClient = new ApiClient(baseURL);

type Registered = {
  id: string;
  key: string;
  machineKey: string;
  openApiKey: string;
  expiresAt: string | null;
  programmeId: string;
};

const state: {
  programmeId?: string;
  otherProgrammeId?: string;
  verify?: Registered;
  wrongScope?: Registered;
  browser?: Registered;
  ipBound?: Registered;
  quota?: Registered;
  lifecycle?: Registered;
} = {};

function skipUnlessReady(t: { skip: (reason: string) => void }) {
  if (!serverReady) {
    t.skip("目标服务器未就绪，跳过 API 测试");
  }
}

function bearer(openApiKey: string) {
  return { Authorization: `Bearer ${openApiKey}` };
}

function codeOf(response: { data: unknown }): string {
  return (response.data as { error: { code: string } }).error.code;
}

async function db() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

async function register(input: {
  key: string;
  displayName: string;
  programmeId: string;
  scopes: string[];
  origins?: string[];
  ips?: string[];
  machineKey?: string;
  rateLimitLimit?: number;
  rateLimitWindowMs?: number;
  expiresInDays?: number;
}): Promise<Registered> {
  const response = await adminClient.post("/api/admin/channel-clients", {
    key: input.key,
    displayName: input.displayName,
    type: "MACHINE",
    programmeId: input.programmeId,
    allowedOrigins: input.origins ?? [],
    allowedIps: input.ips ?? [],
    allowedScopes: input.scopes,
    ...(input.machineKey ? { machineKey: input.machineKey } : {}),
    ...(input.rateLimitLimit ? { rateLimitLimit: input.rateLimitLimit } : {}),
    ...(input.rateLimitWindowMs ? { rateLimitWindowMs: input.rateLimitWindowMs } : {}),
    ...(input.expiresInDays ? { expiresInDays: input.expiresInDays } : {}),
  });
  assert.equal(response.status, 201, `登记客户端失败: ${JSON.stringify(response.data)}`);
  const body = response.data as {
    client: { id: string; key: string; type: string; programmeId: string };
    machineKey: string;
    openApiKey: string;
    machineKeyExpiresAt: string | null;
    warning?: string;
  };
  assert.equal(body.client.type, "MACHINE");
  assert.ok(body.machineKey.startsWith("cpmk_"), "服务端签发的机密带 cpmk_ 前缀");
  assert.equal(body.openApiKey, `${body.client.key}.${body.machineKey}`, "Open API 凭据 = clientKey + 机密");
  assert.ok(body.warning, "明文只出现一次，必须附警示");
  if (input.machineKey) {
    assert.equal(body.machineKey, input.machineKey, "自装机密按原样生效");
  }
  return {
    id: body.client.id,
    key: body.client.key,
    machineKey: body.machineKey,
    openApiKey: body.openApiKey,
    expiresAt: body.machineKeyExpiresAt,
    programmeId: body.client.programmeId,
  };
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("Open API（API Key 控制模式）", () => {
  test("准备：两个 Programme 下登记策略各异的 MACHINE 客户端", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    const login = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(login.status, 200, `管理员登录失败: ${JSON.stringify(login.data)}`);

    const client = await db();
    const tenant = await client.tenant.create({
      data: { key: `openapi-tenant-${suffix}`, name: `Open API Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = async (tag: string) =>
      (await client.programme.create({
        data: { key: `openapi-prog-${tag}-${suffix}`, name: `Open API Programme ${tag} ${suffix}`, tenantId: tenant.id },
        select: { id: true },
      })).id;
    state.programmeId = await programme("a");
    state.otherProgrammeId = await programme("b");

    state.verify = await register({
      key: `CPKV${alphanumeric.slice(0, 11)}`,
      displayName: `Open API verify ${suffix}`,
      programmeId: state.programmeId,
      scopes: [verifyScope],
      machineKey: `cpmk_test_verify_${tail}`,
    });
    state.wrongScope = await register({
      key: `CPKO${alphanumeric.slice(0, 11)}`,
      displayName: `Open API other ${suffix}`,
      programmeId: state.programmeId,
      scopes: [otherScope],
    });
    state.browser = await register({
      key: `CPKB${alphanumeric.slice(0, 11)}`,
      displayName: `Open API browser ${suffix}`,
      programmeId: state.programmeId,
      scopes: [verifyScope],
      origins: ["https://partner.example"],
    });
    state.ipBound = await register({
      key: `CPKI${alphanumeric.slice(0, 11)}`,
      displayName: `Open API ip ${suffix}`,
      programmeId: state.programmeId,
      scopes: [verifyScope],
      ips: ["198.51.100.0/24"],
    });
    state.quota = await register({
      key: `CPKQ${alphanumeric.slice(0, 11)}`,
      displayName: `Open API quota ${suffix}`,
      programmeId: state.otherProgrammeId,
      scopes: [verifyScope],
      rateLimitLimit: 2,
      rateLimitWindowMs: 60_000,
    });
    state.lifecycle = await register({
      key: `CPKL${alphanumeric.slice(0, 11)}`,
      displayName: `Open API lifecycle ${suffix}`,
      programmeId: state.programmeId,
      scopes: [verifyScope],
      expiresInDays: 30,
    });
    assert.ok(state.lifecycle.expiresAt, "登记即写入到期时间，默认有效期由服务端决定");
    assert.ok(new Date(state.lifecycle.expiresAt as string).getTime() > Date.now());
  });

  test("登记校验：机密前缀、72 字节上限与配额成对", async (t) => {
    skipUnlessReady(t);
    const programmeId = state.programmeId as string;
    const base = { displayName: `Open API invalid ${suffix}`, type: "MACHINE", programmeId, allowedOrigins: [], allowedScopes: [verifyScope] };

    const legacyPrefix = await adminClient.post("/api/admin/channel-clients", { ...base, key: `CPKN${alphanumeric.slice(0, 11)}`, machineKey: `cpmk-openapi-hyphen-${suffix}` });
    assert.equal(legacyPrefix.status, 400, "连字符前缀的旧式机密不再接受：它无法通过 parseOpenApiKey");

    const tooLong = await adminClient.post("/api/admin/channel-clients", { ...base, key: `CPKT${alphanumeric.slice(0, 11)}`, machineKey: `cpmk_${"x".repeat(80)}` });
    assert.equal(tooLong.status, 400, "超过 bcrypt 截断边界的机密必须拒绝，而不是静默只校验前 72 字节");

    const halfQuota = await adminClient.post("/api/admin/channel-clients", { ...base, key: `CPKH${alphanumeric.slice(0, 11)}`, rateLimitLimit: 10 });
    assert.equal(halfQuota.status, 400, "配额两字段必须成对");

    const badIp = await adminClient.post("/api/admin/channel-clients", { ...base, key: `CPKP${alphanumeric.slice(0, 11)}`, allowedIps: ["198.51.100.0/330"] });
    assert.equal(badIp.status, 400, "非法 CIDR 在登记时就拒绝");
  });

  test("whoami：只回自己的身份、配额、密钥元数据与访问约束", async (t) => {
    skipUnlessReady(t);
    const verify = state.verify as Registered;
    const response = await openApiClient.get(whoamiPath, bearer(verify.openApiKey));
    assert.equal(response.status, 200, `whoami 失败: ${JSON.stringify(response.data)}`);
    const body = response.data as {
      ok: boolean; clientId: string; clientKey: string; programmeId: string; scopes: string[]; requestId: string;
      rateLimit: { limit: number; windowMs: number; remaining: number; resetAt: number };
      key: { algorithm: string; issuedAt: string | null; expiresAt: string | null; rotatedAt: string | null; lastUsedAt: string | null };
      access: { allowedOrigins: string[]; allowedIps: string[] };
    };
    assert.equal(body.ok, true);
    assert.equal(body.clientId, verify.id);
    assert.equal(body.clientKey, verify.key);
    assert.deepEqual(body.scopes, [verifyScope]);
    assert.equal(body.programmeId, state.programmeId);
    assert.equal(body.rateLimit.limit, 60, "未登记配额的 key 走全局默认");
    assert.equal(body.rateLimit.windowMs, 60_000);
    assert.equal(body.key.algorithm, "bcrypt");
    assert.ok(body.key.issuedAt && new Date(body.key.issuedAt).getTime() >= runStartedAt.getTime() - 60_000);
    assert.equal(body.key.expiresAt, verify.expiresAt);
    assert.equal(body.key.rotatedAt, null);
    assert.deepEqual(body.access, { allowedOrigins: [], allowedIps: [] });
    assert.equal(response.headers.get("x-request-id"), body.requestId);
    const serialized = JSON.stringify(response.data);
    assert.equal(serialized.includes(verify.machineKey), false, "响应不得回传机密");
    assert.equal(serialized.includes(verify.openApiKey), false, "响应不得回传完整凭据");
    assert.equal(serialized.includes("machineKeyBcrypt"), false);

    // 首次调用后 lastUsedAt 落库：运维需要据此判断 key 是否真的在用。
    const second = await openApiClient.get(whoamiPath, bearer(verify.openApiKey));
    assert.equal(second.status, 200);
    assert.notEqual((second.data as { key: { lastUsedAt: string | null } }).key.lastUsedAt, null, "上一次调用应已写入最近使用时间");

    // 跨 Programme：每把 key 只看见自己那套 programme/scope/配额。
    const other = await quotaClient.get(whoamiPath, bearer((state.quota as Registered).openApiKey));
    assert.equal(other.status, 200);
    const otherBody = other.data as typeof body;
    assert.notEqual(otherBody.clientId, body.clientId, "每把 key 只见自己");
    assert.equal(otherBody.programmeId, state.otherProgrammeId);
    assert.equal(otherBody.rateLimit.limit, 2, "该 key 的登记配额覆盖默认值");
    assert.equal(otherBody.access.allowedIps.length, 0);
  });

  test("鉴权失败矩阵：缺头 / 非 Bearer / 旧式裸机密 / 未知客户端 / 会话不算数", async (t) => {
    skipUnlessReady(t);
    const verify = state.verify as Registered;

    const anonymous = await openApiClient.get(whoamiPath);
    assert.equal(anonymous.status, 401);
    assert.ok(anonymous.headers.get("content-type")?.includes("application/json"), "鉴权失败必须是 JSON");
    assert.equal(codeOf(anonymous), "API_KEY_MISSING");
    assert.equal(typeof (anonymous.data as { error: { requestId?: string } }).error.requestId, "string");

    const basic = await openApiClient.get(whoamiPath, { Authorization: `Basic ${Buffer.from(verify.openApiKey).toString("base64")}` });
    assert.equal(basic.status, 401);
    assert.equal(codeOf(basic), "API_KEY_INVALID");

    // 旧式裸 machine key：没有 clientKey 段就无法定位行，bcrypt 也不允许按摘要反查。
    const bare = await openApiClient.get(whoamiPath, bearer(verify.machineKey));
    assert.equal(bare.status, 401);
    assert.equal(codeOf(bare), "API_KEY_INVALID");

    const unknownClient = await openApiClient.get(whoamiPath, bearer(`CPKUNKNOWN${alphanumeric.slice(0, 8)}.cpmk_test_wrong_${tail}`));
    assert.equal(unknownClient.status, 401);
    assert.equal(codeOf(unknownClient), "API_KEY_INVALID");

    const wrongSecret = await openApiClient.get(whoamiPath, bearer(`${verify.key}.cpmk_test_wrong_${tail}`));
    assert.equal(wrongSecret.status, 401);
    assert.equal(codeOf(wrongSecret), "API_KEY_INVALID");

    const oversized = await openApiClient.get(whoamiPath, bearer(`${verify.key}.cpmk_${"x".repeat(140)}`));
    assert.equal(oversized.status, 401);
    assert.equal(codeOf(oversized), "API_KEY_INVALID", "超长 bearer 直接判定格式非法，不进数据库");

    // cookie 会话（管理员）不能替代 API Key：否则 Open API 会变成第二条登录旁路。
    const sessionOnly = await adminClient.get(whoamiPath);
    assert.equal(sessionOnly.status, 401);
    assert.equal(codeOf(sessionOnly), "API_KEY_MISSING");
  });

  test("证书验真：鉴权通过进入业务（404 NOT_FOUND），scope 不足 403", async (t) => {
    skipUnlessReady(t);
    const verified = await openApiClient.get(missingCodePath, bearer((state.verify as Registered).openApiKey));
    assert.equal(verified.status, 404, `应进入业务并由验真返回 NOT_FOUND: ${JSON.stringify(verified.data)}`);
    const body = verified.data as { status: string; valid: boolean; verificationCode: string; certificate?: unknown };
    assert.equal(body.status, "NOT_FOUND");
    assert.equal(body.valid, false);
    assert.equal(body.certificate, undefined, "不存在的证书不得带回任何字段");
    assert.match(verified.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/, "成功响应也要带可关联的请求号");

    const denied = await otherKeyClient.get(missingCodePath, bearer((state.wrongScope as Registered).openApiKey));
    assert.equal(denied.status, 403);
    const deniedBody = denied.data as { error: { code: string; requestId: string } };
    assert.equal(deniedBody.error.code, "API_KEY_SCOPE_DENIED");
    assert.equal(denied.headers.get("x-request-id"), deniedBody.error.requestId);

    // 没有凭据时不得退回任何公开分支（/api/v1/channel 那条会落回环境门）。
    const anonymousVerify = await openApiClient.get(missingCodePath);
    assert.equal(anonymousVerify.status, 401);
    assert.equal(codeOf(anonymousVerify), "API_KEY_MISSING");
    assert.equal(JSON.stringify(anonymousVerify.data).includes("verificationCode"), false);
  });

  test("来源约束：Origin 必须命中白名单，服务端调用改看 allowedIps", async (t) => {
    skipUnlessReady(t);
    const browser = state.browser as Registered;

    const allowed = await browserClient.get(whoamiPath, { ...bearer(browser.openApiKey), Origin: "https://partner.example" });
    assert.equal(allowed.status, 200, `命中白名单应通过: ${JSON.stringify(allowed.data)}`);

    const evil = await browserClient.get(whoamiPath, { ...bearer(browser.openApiKey), Origin: "https://evil.example" });
    assert.equal(evil.status, 403);
    assert.equal(codeOf(evil), "API_KEY_ORIGIN_DENIED");
    assert.equal((evil.data as { error: { requestId: string } }).error.requestId, evil.headers.get("x-request-id"));

    // 空 allowedOrigins 的 key 一律拒绝浏览器调用——这正是「对 Open API 强制 origin」
    // 的含义：不给「未声明却可被浏览器携带凭据」留口子。
    const serverOnlyFromBrowser = await openApiClient.get(whoamiPath, { ...bearer((state.verify as Registered).openApiKey), Origin: "https://partner.example" });
    assert.equal(serverOnlyFromBrowser.status, 403);
    assert.equal(codeOf(serverOnlyFromBrowser), "API_KEY_ORIGIN_DENIED");

    const ipBound = state.ipBound as Registered;
    // 白名单非空却拿不到可归因地址：fail closed，而不是放行。
    const unattributed = await ipBoundClient.get(whoamiPath, bearer(ipBound.openApiKey));
    assert.equal(unattributed.status, 403);
    assert.equal(codeOf(unattributed), "API_KEY_IP_DENIED");

    const inRange = await ipBoundClient.get(whoamiPath, { ...bearer(ipBound.openApiKey), "x-real-ip": "198.51.100.7" });
    assert.equal(inRange.status, 200, `CIDR 内地址应通过: ${JSON.stringify(inRange.data)}`);

    const outOfRange = await ipBoundClient.get(whoamiPath, { ...bearer(ipBound.openApiKey), "x-real-ip": "203.0.113.5" });
    assert.equal(outOfRange.status, 403);
    assert.equal(codeOf(outOfRange), "API_KEY_IP_DENIED");

    // Origin 优先：带 Origin 时不看 IP，避免两种口径同时生效时互相掩盖。
    const browserOnIpBound = await ipBoundClient.get(whoamiPath, { ...bearer(ipBound.openApiKey), Origin: "https://partner.example", "x-real-ip": "198.51.100.7" });
    assert.equal(browserOnIpBound.status, 403);
    assert.equal(codeOf(browserOnIpBound), "API_KEY_ORIGIN_DENIED");
  });

  test("配额：越限 429 带 Retry-After，PATCH 改配即时生效", async (t) => {
    skipUnlessReady(t);
    const quota = state.quota as Registered;

    // 该 key 的配额是 2/60s：连续调用必然触顶，且不依赖其他用例的调用次数。
    let allowed = 0;
    let blocked: Awaited<ReturnType<ApiClient["get"]>> | null = null;
    for (let attempt = 0; attempt < 5 && !blocked; attempt += 1) {
      const response = await quotaClient.get(whoamiPath, bearer(quota.openApiKey));
      if (response.status === 200) {
        allowed += 1;
        const meta = (response.data as { rateLimit: { limit: number; windowMs: number; remaining: number } }).rateLimit;
        assert.deepEqual({ limit: meta.limit, windowMs: meta.windowMs }, { limit: 2, windowMs: 60_000 });
        assert.ok(meta.remaining >= 0 && meta.remaining < meta.limit);
      } else {
        blocked = response;
      }
    }
    assert.ok(allowed > 0 && allowed <= 2, `2/60s 的配额应在 1~2 次后触顶，实际通过 ${allowed} 次`);
    const limited = blocked;
    assert.ok(limited, "持续调用必须触发限流");
    assert.equal(limited.status, 429);
    assert.equal(codeOf(limited), "RATE_LIMITED");
    const retryAfter = Number(limited.headers.get("retry-after"));
    assert.ok(Number.isFinite(retryAfter) && retryAfter >= 1, "429 必须给出 Retry-After");
    assert.equal(limited.headers.get("retry-after"), String((limited.data as { error: { retryAfter: number } }).error.retryAfter));

    // 其他 key 不受影响：配额是按 key 隔离的，不是全局熔断。
    const untouched = await openApiClient.get(whoamiPath, bearer((state.verify as Registered).openApiKey));
    assert.equal(untouched.status, 200);

    const halfPatch = await adminClient.patch(`/api/admin/channel-clients/${quota.id}`, { rateLimitWindowMs: 30_000 });
    assert.equal(halfPatch.status, 400, "改配也必须成对提交");

    const raised = await adminClient.patch(`/api/admin/channel-clients/${quota.id}`, { rateLimitLimit: 5, rateLimitWindowMs: 30_000 });
    assert.equal(raised.status, 200, `改配失败: ${JSON.stringify(raised.data)}`);
    // 改配即时生效：桶键里没有配额，窗口内的计数会沿用，但上限按新值判定。
    const afterPatch = await quotaClient.get(whoamiPath, bearer(quota.openApiKey));
    assert.equal(afterPatch.status, 200, `改配后应恢复: ${JSON.stringify(afterPatch.data)}`);
    const { limit, windowMs } = (afterPatch.data as { rateLimit: { limit: number; windowMs: number } }).rateLimit;
    assert.deepEqual({ limit, windowMs }, { limit: 5, windowMs: 30_000 });

    const reset = await adminClient.patch(`/api/admin/channel-clients/${quota.id}`, { rateLimitLimit: null, rateLimitWindowMs: null });
    assert.equal(reset.status, 200);
    const backToDefault = await quotaClient.get(whoamiPath, bearer(quota.openApiKey));
    assert.equal((backToDefault.data as { rateLimit: { limit: number } }).rateLimit.limit, 60, "成对 null 回到全局默认");
  });

  test("生命周期：过期 403，轮换后旧 key 当场失效", async (t) => {
    skipUnlessReady(t);
    const lifecycle = state.lifecycle as Registered;
    const client = await db();

    await client.channelClient.update({ where: { id: lifecycle.id }, data: { machineKeyExpiresAt: new Date(Date.now() - 60_000) } });
    const expired = await lifecycleClient.get(whoamiPath, bearer(lifecycle.openApiKey));
    assert.equal(expired.status, 403, "过期是策略拒绝，不是凭据非法");
    assert.equal(codeOf(expired), "API_KEY_EXPIRED");

    const rotate = await adminClient.post(`/api/admin/channel-clients/${lifecycle.id}/rotate-key`, { expiresInDays: 90, reason: "open api lifecycle test" });
    assert.equal(rotate.status, 200, `轮换失败: ${JSON.stringify(rotate.data)}`);
    const rotated = rotate.data as { client: { id: string; key: string }; machineKey: string; openApiKey: string; machineKeyExpiresAt: string };
    assert.equal(rotated.client.id, lifecycle.id);
    assert.notEqual(rotated.machineKey, lifecycle.machineKey);
    assert.ok(new Date(rotated.machineKeyExpiresAt).getTime() > Date.now(), "轮换重新计时");

    const stale = await lifecycleClient.get(whoamiPath, bearer(lifecycle.openApiKey));
    assert.equal(stale.status, 401, "旧机密必须当场失效");
    assert.equal(codeOf(stale), "API_KEY_INVALID");

    const fresh = await lifecycleClient.get(whoamiPath, bearer(rotated.openApiKey));
    assert.equal(fresh.status, 200, `新 key 应立即可用: ${JSON.stringify(fresh.data)}`);
    const key = (fresh.data as { key: { algorithm: string; rotatedAt: string | null; expiresAt: string | null } }).key;
    assert.equal(key.algorithm, "bcrypt");
    assert.ok(key.rotatedAt);
    assert.equal(key.expiresAt, new Date(rotated.machineKeyExpiresAt).toISOString());

    const rotateRevoked = await adminClient.post(`/api/admin/channel-clients/${lifecycle.id}/rotate-key`, { expiresInDays: 1 });
    assert.equal(rotateRevoked.status, 200);
  });

  test("撤销立即失效，且管理台列表不外泄摘要列", async (t) => {
    skipUnlessReady(t);
    const list = await adminClient.get(`/api/admin/channel-clients?programmeId=${state.programmeId}`);
    assert.equal(list.status, 200);
    const clients = (list.data as { clients: Array<Record<string, unknown> & { key: string }> }).clients;
    const serialized = JSON.stringify(clients);
    assert.equal(serialized.includes("machineKeyHash"), false, "列表不得带回 sha256 摘要列");
    assert.equal(serialized.includes("machineKeyBcrypt"), false, "列表不得带回 bcrypt 摘要列");
    assert.equal(serialized.includes("$2"), false, "任何 bcrypt 摘要都不得外传");
    for (const registered of [state.verify, state.wrongScope, state.browser, state.ipBound, state.lifecycle] as Registered[]) {
      const row = clients.find((entry) => entry.key === registered.key);
      assert.ok(row, `列表缺少 ${registered.key}`);
      assert.equal(row.machineKeyAlgorithm, "bcrypt");
      assert.equal(row.machineKeyConfigured, true);
    }

    const revoke = await adminClient.post(`/api/admin/channel-clients/${state.verify?.id}/revoke`, { reason: "open api test teardown" });
    assert.equal(revoke.status, 200, `撤销失败: ${JSON.stringify(revoke.data)}`);
    const after = await openApiClient.get(whoamiPath, bearer((state.verify as Registered).openApiKey));
    assert.equal(after.status, 401);
    assert.equal(codeOf(after), "API_KEY_INVALID");

    const client = await db();
    const revoked = await client.channelClient.findUnique({ where: { id: (state.verify as Registered).id }, select: { revokedAt: true, revokeReason: true } });
    assert.ok(revoked?.revokedAt, "撤销时刻落库");
    assert.equal(revoked?.revokeReason, "open api test teardown");

    const secondRevoke = await adminClient.post(`/api/admin/channel-clients/${state.verify?.id}/revoke`, { reason: "again" });
    assert.equal(secondRevoke.status, 409);
    const rotateRevoked = await adminClient.post(`/api/admin/channel-clients/${state.verify?.id}/rotate-key`, {});
    assert.equal(rotateRevoked.status, 409, "已撤销的客户端不得再签发机密");
  });

  test("审计：失败可归因且不含 key 材料", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const rows = await client.coreAuditLog.findMany({
      where: { action: "openapi.access.denied", createdAt: { gte: runStartedAt } },
      select: { subjectType: true, subjectId: true, result: true, metadataJson: true },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(rows.length >= 12, `应记录到多条拒绝审计，实际 ${rows.length} 条`);
    const results = rows.map((row) => row.result);
    for (const expected of ["API_KEY_MISSING", "API_KEY_INVALID", "API_KEY_SCOPE_DENIED", "API_KEY_ORIGIN_DENIED", "API_KEY_IP_DENIED", "API_KEY_EXPIRED", "RATE_LIMITED"]) {
      assert.ok(results.includes(expected), `审计缺少 ${expected}：${JSON.stringify(results)}`);
    }

    // 策略类拒绝必须归因到具体客户端；纯凭据类失败没有主体，只有来源地址。
    const registeredClients = [
      state.verify, state.wrongScope, state.browser, state.ipBound, state.quota, state.lifecycle,
    ] as Registered[];
    const attributed = rows.filter((row) => row.subjectType === "ChannelClient");
    assert.ok(attributed.length >= 5, `策略拒绝应已归因，实际 ${attributed.length} 条`);
    const attributedIds = new Set(attributed.map((row) => row.subjectId as string));
    const known = new Set(registeredClients.map((entry) => entry.id));
    for (const id of attributedIds) {
      assert.ok(known.has(id as string), `审计归因到了未知客户端 ${id}`);
    }
    assert.ok(attributedIds.has((state.wrongScope as Registered).id), "scope 拒绝归因到该客户端");
    assert.ok(attributedIds.has((state.browser as Registered).id), "origin 拒绝归因到该客户端");
    assert.ok(attributedIds.has((state.ipBound as Registered).id), "IP 拒绝归因到该客户端");
    assert.ok(rows.some((row) => row.subjectType === "OpenApi" && row.subjectId === null), "无凭据失败以 OpenApi 主体记录");

    const serialized = JSON.stringify(rows);
    for (const registered of registeredClients) {
      assert.equal(serialized.includes(registered.machineKey), false, "审计不得存机密明文");
      assert.equal(serialized.includes(registered.openApiKey), false, "审计不得存完整凭据");
    }
    assert.equal(serialized.includes("machineKeyBcrypt"), false);
    assert.equal(serialized.includes("$2"), false);
  });
});
