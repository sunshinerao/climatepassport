/**
 * Open API 密钥控制层单元测试（源码级：transpile 真实依赖链 + 内存 Prisma mock）
 *
 * 被测范围不止 open-api-auth.ts 自身：channel-client-auth（凭据解析、bcrypt/遗留摘要分派、
 * 过期判定、来源约束、最近使用节流）与 ip-cidr（CIDR 匹配）都按真实实现跑，
 * 只 mock prisma / audit / rate-limit 三个外部边界。
 *
 * 覆盖：
 * - readOpenApiKey：无头 / 非 Bearer / 空 bearer / 超长 bearer / 正常 bearer、大小写与空白
 * - parseOpenApiKey：缺分隔符、clientKey 形态不符、机密无 cpmk_ 前缀、机密超 bcrypt 72 字节
 *   → 一律 401，且不触碰客户端表
 * - authenticateOpenApiKey：未知 key、已撤销、USER_FACING、Programme 停用、无密钥材料、
 *   机密不符一律 401；过期 403 API_KEY_EXPIRED；scope 不符 403（可归因）
 * - 遗留无盐 sha256 行仍可校验通过，轮换清空摘要后立即失效
 * - 来源约束：带 Origin 必须命中 allowedOrigins（空白名单也拒绝）；无 Origin 才看 allowedIps；
 *   未启用反代信任时 x-forwarded-for 不算数；白名单非空却无从归因 → fail-closed
 * - 每把 key 的配额：登记值生效，未登记回落到默认
 * - requireOpenApiKey：503 失败关闭、429 带 Retry-After、限流后端不可用 503（两类窗口都以
 *   sensitive 申请）、密钥被拒时同时消耗匿名预算
 * - 错误信封固定为 { error: { code, message, requestId } } 且回 x-request-id 头；
 *   审计与响应绝不出现 bearer 原文或摘要
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createNextResponseMock } from "./_route-loader.mjs";

const require = createRequire(import.meta.url);
const { hashSync } = require("bcryptjs");

const CLIENT_KEY = "CPKTEST0000001";
const MACHINE_KEY = "cpmk_unit_test_secret_0123456789abcdefghij";
const TOKEN = `${CLIENT_KEY}.${MACHINE_KEY}`;
const BCRYPT_HASH = hashSync(MACHINE_KEY, 4);
const LEGACY_HASH = createHash("sha256").update(MACHINE_KEY, "utf8").digest("hex");

/** The modules under test run in a vm realm, so compare plain structures instead of prototypes. */
function jsonEqual(actual, expected, message) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message);
}

const loadedDependencies = new Map();

function compileModule(sourcePath, mocks) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    console,
    URL,
    Request,
    Response,
    Headers,
    Buffer,
    Date,
    crypto: globalThis.crypto,
    process,
    setTimeout,
    clearTimeout,
    require: (name) => {
      if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
      if (name.startsWith("@/")) return loadDependency(name);
      return require(name);
    },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

/**
 * Transpile a `@/lib/server/*` dependency for real — its credential and CIDR logic is part of
 * what these tests prove. Cached, because a fresh realm per call would re-import bcryptjs and
 * the modules below hold no per-test state.
 */
function loadDependency(specifier) {
  if (!loadedDependencies.has(specifier)) {
    loadedDependencies.set(specifier, compileModule(path.resolve("apps/passport-web", `${specifier.slice(2)}.ts`), {}));
  }
  return loadedDependencies.get(specifier);
}

const realRateLimit = loadDependency("@/lib/server/rate-limit");
const channelAuth = loadDependency("@/lib/server/channel-client-auth");

function machineClientRow(overrides = {}) {
  return {
    id: "client-1",
    key: CLIENT_KEY,
    displayName: "Test partner",
    programmeId: "programme-1",
    allowedScopes: ["channel:certificates:verify"],
    allowedOrigins: [],
    allowedIps: [],
    isActive: true,
    type: "MACHINE",
    machineKeyHash: null,
    machineKeyBcrypt: BCRYPT_HASH,
    machineKeyIssuedAt: new Date("2026-01-01T00:00:00.000Z"),
    machineKeyExpiresAt: null,
    machineKeyRotatedAt: null,
    machineKeyLastUsedAt: null,
    rateLimitLimit: null,
    rateLimitWindowMs: null,
    programme: { isActive: true },
    ...overrides,
  };
}

function loadOpenApiAuthModule({ row, rateLimitResults = {}, prismaUnavailable = false } = {}) {
  const auditRows = [];
  const rateLimitKeys = [];
  const rateLimitOptions = [];
  const findFirstCalls = [];
  const touchCalls = [];
  const NextResponse = createNextResponseMock();
  const prisma = { channelClient: fakeChannelClientLookup(row, { calls: findFirstCalls, touches: touchCalls }) };

  const module = compileModule(path.resolve("apps/passport-web/lib/server/open-api-auth.ts"), {
    "next/server": { NextResponse },
    "@/lib/server/prisma": { getPrismaClient: () => (prismaUnavailable ? null : prisma) },
    "@/lib/server/audit": {
      getRequestAuditContext: () => ({ ipAddress: "203.0.113.9", userAgent: "unit-test" }),
      writeCoreAuditLog: async (input) => {
        auditRows.push(input);
        return null;
      },
    },
    "@/lib/server/rate-limit": {
      ...realRateLimit,
      checkRateLimitAsync: async (key, options) => {
        rateLimitKeys.push(key);
        rateLimitOptions.push(options);
        const outcome = rateLimitResults[key.startsWith("open-api:unauthenticated") ? "unauthenticated" : "authenticated"]
          ?? { allowed: true, remaining: 59, resetAt: 1_800_000_000_000 };
        return { remaining: outcome.remaining ?? 59, resetAt: outcome.resetAt ?? 1_800_000_000_000, allowed: outcome.allowed ?? true, unavailable: outcome.unavailable ?? false };
      },
      getRateLimitRetryAfter: () => 42,
    },
  });

  return { module, prisma, auditRows, rateLimitKeys, rateLimitOptions, findFirstCalls, touchCalls };
}

function bearerRequest(token = TOKEN, extra = {}) {
  return new Request("https://passport.test/api/v1/open/certificates/CV-1", {
    headers: token === null ? extra : { authorization: `Bearer ${token}`, ...extra },
  });
}

function fakeChannelClientLookup(getRow, record) {
  return {
    findFirst: async (args) => {
      record?.calls.push(args);
      const row = typeof getRow === "function" ? getRow() : getRow;
      // Honour the predicates the module relies on: the bearer carries the client key, and
      // a USER_FACING row must not resolve for a machine lookup.
      if (!row) return null;
      if (args.where.key !== row.key) return null;
      if (args.where.type && args.where.type !== row.type) return null;
      return row;
    },
    updateMany: async (args) => {
      record?.touches.push(args);
      return { count: 1 };
    },
  };
}

function authenticate(module, input = {}) {
  return module.authenticateOpenApiKey(
    { channelClient: fakeChannelClientLookup(input.row ?? null, { calls: [], touches: [] }) },
    { token: input.token ?? TOKEN, requiredScope: input.requiredScope, origin: input.origin ?? null, clientIp: input.clientIp ?? null },
  );
}

test("readOpenApiKey accepts only a well-formed bearer credential", () => {
  const { module } = loadOpenApiAuthModule({ row: machineClientRow() });
  const headers = (value) => new Headers(value === undefined ? {} : { authorization: value });
  assert.equal(module.readOpenApiKey(headers()).shape, "absent");
  assert.equal(module.readOpenApiKey(headers("Basic abc")).shape, "malformed");
  assert.equal(module.readOpenApiKey(headers("Bearer   ")).shape, "malformed");
  assert.equal(module.readOpenApiKey(headers(`Bearer ${"x".repeat(200)}`)).shape, "malformed");
  jsonEqual(module.readOpenApiKey(headers(`Bearer ${TOKEN}`)), { shape: "present", token: TOKEN });
  // scheme is case-insensitive, surrounding whitespace is trimmed
  jsonEqual(module.readOpenApiKey(headers(`BEARER  ${TOKEN} `)), { shape: "present", token: TOKEN });
});

test("parseOpenApiKey splits the self-locating credential and rejects unusable shapes", () => {
  jsonEqual(channelAuth.parseOpenApiKey(TOKEN), { clientKey: CLIENT_KEY, machineKey: MACHINE_KEY });
  assert.equal(channelAuth.parseOpenApiKey(MACHINE_KEY), null, "a bare secret cannot locate the client");
  assert.equal(channelAuth.parseOpenApiKey(`${CLIENT_KEY}.`), null);
  assert.equal(channelAuth.parseOpenApiKey(`.${MACHINE_KEY}`), null);
  assert.equal(channelAuth.parseOpenApiKey(`lowercase.${MACHINE_KEY}`), null, "client keys are upper-alphanumeric");
  assert.equal(channelAuth.parseOpenApiKey(`${CLIENT_KEY}.deadbeefdeadbeef`), null, "secrets must carry the cpmk_ prefix");
  assert.equal(channelAuth.parseOpenApiKey(`${CLIENT_KEY}.cpmk_${"x".repeat(80)}`), null, "bcrypt truncates past 72 bytes");
});

test("a credential that cannot locate a client is rejected without touching the table", async () => {
  const { module, findFirstCalls } = loadOpenApiAuthModule({ row: machineClientRow() });
  const result = await authenticate(module, { token: "not-a-key-pair" });
  jsonEqual(result, { ok: false, status: 401, code: "API_KEY_INVALID" });
  assert.equal(findFirstCalls.length, 0);
});

test("authenticateOpenApiKey fails closed on every non-usable key", async () => {
  const cases = [
    { label: "unknown client", row: null, status: 401, code: "API_KEY_INVALID" },
    { label: "revoked client", row: machineClientRow({ isActive: false }), status: 401, code: "API_KEY_INVALID" },
    { label: "user-facing client", row: machineClientRow({ type: "USER_FACING" }), status: 401, code: "API_KEY_INVALID" },
    { label: "inactive programme", row: machineClientRow({ programme: { isActive: false } }), status: 401, code: "API_KEY_INVALID" },
    { label: "no secret configured", row: machineClientRow({ machineKeyBcrypt: null }), status: 401, code: "API_KEY_INVALID" },
    { label: "wrong secret", row: machineClientRow({ machineKeyBcrypt: hashSync("cpmk_some_other_secret_value", 4) }), status: 401, code: "API_KEY_INVALID" },
    { label: "expired key", row: machineClientRow({ machineKeyExpiresAt: new Date(Date.now() - 1) }), status: 403, code: "API_KEY_EXPIRED" },
    { label: "missing scope", row: machineClientRow({ allowedScopes: [] }), status: 403, code: "API_KEY_SCOPE_DENIED" },
  ];
  for (const testCase of cases) {
    const { module } = loadOpenApiAuthModule({ row: testCase.row });
    const result = await authenticate(module, { row: testCase.row, requiredScope: "channel:certificates:verify" });
    assert.equal(result.ok, false, testCase.label);
    assert.equal(result.status, testCase.status, testCase.label);
    assert.equal(result.code, testCase.code, testCase.label);
  }
});

test("secret verification follows the row's own storage generation", async () => {
  const legacy = machineClientRow({ machineKeyBcrypt: null, machineKeyHash: LEGACY_HASH });
  const { module } = loadOpenApiAuthModule({ row: legacy });
  assert.equal((await authenticate(module, { row: legacy, requiredScope: "channel:certificates:verify" })).ok, true, "pre-migration sha256 rows keep working");
  assert.equal(await channelAuth.verifyChannelMachineSecret({ machineKeyHash: LEGACY_HASH, machineKeyBcrypt: null }, "cpmk_wrong_secret"), false);
  assert.equal(await channelAuth.verifyChannelMachineSecret({ machineKeyHash: null, machineKeyBcrypt: null }, MACHINE_KEY), false, "no stored secret can never mean an empty key passes");

  // Rotation clears the legacy digest, so the same row stops accepting the old generation.
  const rotated = machineClientRow({ machineKeyHash: null, machineKeyBcrypt: hashSync("cpmk_rotated_secret_value_here", 4) });
  const rotatedGate = loadOpenApiAuthModule({ row: rotated });
  const denied = await authenticate(rotatedGate.module, { row: rotated, requiredScope: "channel:certificates:verify" });
  jsonEqual(denied, { ok: false, status: 401, code: "API_KEY_INVALID" }, "the pre-rotation secret must not verify once bcrypt is installed");
});

test("browser origins are denied outright unless the key allowlists them", async () => {
  const cases = [
    { label: "empty allowlist", row: machineClientRow(), origin: "https://partner.example", code: "API_KEY_ORIGIN_DENIED" },
    { label: "unlisted origin", row: machineClientRow({ allowedOrigins: ["https://other.example"] }), origin: "https://partner.example", code: "API_KEY_ORIGIN_DENIED" },
  ];
  for (const testCase of cases) {
    const { module } = loadOpenApiAuthModule({ row: testCase.row });
    const result = await authenticate(module, { row: testCase.row, origin: testCase.origin, clientIp: "203.0.113.9" });
    assert.equal(result.ok, false, testCase.label);
    assert.equal(result.code, testCase.code, testCase.label);
    assert.equal(result.status, 403, testCase.label);
    assert.equal(result.clientId, "client-1", `${testCase.label}: a presented browser origin stays attributable`);
  }

  const listed = machineClientRow({ allowedOrigins: ["https://partner.example"] });
  const listedGate = loadOpenApiAuthModule({ row: listed });
  const ok = await authenticate(listedGate.module, { row: listed, origin: "https://partner.example/" });
  assert.equal(ok.ok, true, "trailing slash in the presented Origin is normalized");
});

test("server-to-server callers are constrained by the address allowlist", async () => {
  const row = machineClientRow({ allowedIps: ["198.51.100.0/24", "2001:db8::5"] });
  const { module } = loadOpenApiAuthModule({ row });

  const inside = await authenticate(module, { row, clientIp: "198.51.100.77" });
  assert.equal(inside.ok, true, "an allowlisted v4 address passes");
  const v6 = await authenticate(module, { row, clientIp: "2001:db8::5" });
  assert.equal(v6.ok, true, "an allowlisted v6 address passes");
  const outside = await authenticate(module, { row, clientIp: "203.0.113.9" });
  jsonEqual({ ok: outside.ok, code: outside.code, clientId: outside.clientId }, { ok: false, code: "API_KEY_IP_DENIED", clientId: "client-1" });
  const unattributed = await authenticate(module, { row });
  assert.equal(unattributed.code, "API_KEY_IP_DENIED", "a non-empty allowlist with no resolvable address fails closed");

  const unconstrained = machineClientRow();
  const unconstrainedGate = loadOpenApiAuthModule({ row: unconstrained });
  assert.equal((await authenticate(unconstrainedGate.module, { row: unconstrained })).ok, true, "an empty allowlist adds no constraint beyond the key itself");
});

test("caller attribution follows the same proxy-trust rule as rate limiting", () => {
  const { module } = loadOpenApiAuthModule({ row: machineClientRow() });
  const forwarded = new Headers({ "x-forwarded-for": "198.51.100.77, 10.0.0.1" });
  const saved = process.env.RATE_LIMIT_TRUST_PROXY;
  try {
    delete process.env.RATE_LIMIT_TRUST_PROXY;
    assert.equal(channelAuth.readCallerIp(forwarded), null, "an untrusted proxy means the header is attacker-controlled");
    process.env.RATE_LIMIT_TRUST_PROXY = "true";
    assert.equal(channelAuth.readCallerIp(forwarded), "198.51.100.77", "the client-facing hop wins");
    assert.equal(channelAuth.readCallerIp(new Headers({ "x-forwarded-for": "not-an-ip" })), null);
  } finally {
    if (saved === undefined) delete process.env.RATE_LIMIT_TRUST_PROXY;
    else process.env.RATE_LIMIT_TRUST_PROXY = saved;
  }
});

test("each key carries its own quota and an unconfigured key falls back to the default", async () => {
  const configured = machineClientRow({ rateLimitLimit: 5000, rateLimitWindowMs: 300_000 });
  const configuredGate = loadOpenApiAuthModule({ row: configured });
  const granted = await configuredGate.module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(granted.ok, true);
  assert.deepEqual({ limit: granted.rateLimit.limit, windowMs: granted.rateLimit.windowMs }, { limit: 5000, windowMs: 300_000 });
  assert.equal(configuredGate.rateLimitOptions.at(-1).limit, 5000);
  assert.equal(configuredGate.rateLimitOptions.at(-1).windowMs, 300_000);
  jsonEqual(granted.client.rateLimit, { limit: 5000, windowMs: 300_000, configured: true });
  jsonEqual(granted.client.keyMeta, {
    algorithm: "bcrypt",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
    rotatedAt: null,
    lastUsedAt: null,
  });

  const defaulted = loadOpenApiAuthModule({ row: machineClientRow() });
  const defaultGate = await defaulted.module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(defaultGate.ok, true);
  assert.equal(defaulted.rateLimitOptions.at(-1).limit, 60);
  assert.equal(defaulted.rateLimitOptions.at(-1).windowMs, 60_000);
  assert.equal(defaultGate.client.rateLimit.configured, false);
});

test("a granted key records usage without rewriting it on every call", async () => {
  const { module, touchCalls, prisma } = loadOpenApiAuthModule({ row: machineClientRow() });
  await module.authenticateOpenApiKey(prisma, { token: TOKEN, origin: null, clientIp: null });
  assert.equal(touchCalls.length, 1);
  assert.equal(touchCalls[0].where.id, "client-1");
  assert.equal(touchCalls[0].data.machineKeyLastUsedAt instanceof Date, true);
  assert.ok(touchCalls[0].where.OR.some((clause) => clause.machineKeyLastUsedAt === null));

  // The throttle is a conditional UPDATE rather than a read-then-write: concurrent requests
  // cannot both decide "stale enough" and double-write, and a hot key costs one write per minute.
  const recent = machineClientRow({ machineKeyLastUsedAt: new Date() });
  const recentGate = loadOpenApiAuthModule({ row: recent });
  await recentGate.module.authenticateOpenApiKey(recentGate.prisma, { token: TOKEN, origin: null, clientIp: null });
  assert.equal(recentGate.touchCalls.length, 1);
  const guard = recentGate.touchCalls[0].where;
  assert.equal(guard.id, "client-1");
  assert.equal(guard.OR.length, 2, "the write stays bounded by a null-or-threshold guard");
  assert.ok(guard.OR[1].machineKeyLastUsedAt.lt instanceof Date);
});

test("requireOpenApiKey returns the documented error envelope and request id", async () => {
  const { module } = loadOpenApiAuthModule({ row: null });
  const denied = await module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(denied.ok, false);
  assert.equal(denied.response.status, 401);
  jsonEqual(denied.response.body, {
    error: {
      code: "API_KEY_INVALID",
      message: "Invalid API key.",
      requestId: denied.requestId,
    },
  });
  assert.equal(denied.response.headers["x-request-id"], denied.requestId);

  const missing = await module.requireOpenApiKey(bearerRequest(null, { "content-type": "application/json" }));
  assert.equal(missing.response.status, 401);
  assert.equal(missing.response.body.error.code, "API_KEY_MISSING");
  assert.equal(typeof missing.response.body.error.requestId, "string");
});

test("expired and origin denials keep their distinct codes end to end", async () => {
  const expired = loadOpenApiAuthModule({ row: machineClientRow({ machineKeyExpiresAt: new Date(Date.now() - 1) }) });
  const expiredDenied = await expired.module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(expiredDenied.response.status, 403);
  assert.equal(expiredDenied.response.body.error.code, "API_KEY_EXPIRED");
  assert.equal(expired.auditRows.at(-1).subjectId, "client-1");

  const origin = loadOpenApiAuthModule({ row: machineClientRow({ allowedOrigins: ["https://elsewhere.example"] }) });
  const originDenied = await origin.module.requireOpenApiKey(bearerRequest(TOKEN, { origin: "https://partner.example" }), { scope: "channel:certificates:verify" });
  assert.equal(originDenied.response.status, 403);
  assert.equal(originDenied.response.body.error.code, "API_KEY_ORIGIN_DENIED");
});

test("scope denial stays attributable while key denial stays anonymous", async () => {
  const deniedScope = loadOpenApiAuthModule({ row: machineClientRow({ allowedScopes: [] }) });
  const scopeResult = await authenticate(deniedScope.module, { row: machineClientRow({ allowedScopes: [] }), requiredScope: "channel:certificates:verify" });
  assert.equal(scopeResult.clientId, "client-1", "scope denial must carry the resolved client id");

  const gate = loadOpenApiAuthModule({ row: machineClientRow({ allowedScopes: [] }) });
  const denied = await gate.module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(denied.ok, false);
  assert.equal(denied.response.status, 403);
  const audit = gate.auditRows.at(-1);
  assert.equal(audit.subjectType, "ChannelClient");
  assert.equal(audit.subjectId, "client-1");
  assert.equal(audit.result, "API_KEY_SCOPE_DENIED");

  const unknown = loadOpenApiAuthModule({ row: null });
  const unknownDenied = await unknown.module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(unknownDenied.response.status, 401);
  const unknownAudit = unknown.auditRows.at(-1);
  assert.equal(unknownAudit.subjectType, "OpenApi");
  assert.equal(unknownAudit.subjectId ?? null, null);
});

test("rate limiting is keyed per client and per scope, and 429 carries Retry-After", async () => {
  const limited = loadOpenApiAuthModule({
    row: machineClientRow(),
    rateLimitResults: { authenticated: { allowed: false, remaining: 0, resetAt: 1_800_000_000_000 } },
  });
  const denied = await limited.module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(denied.response.status, 429);
  assert.equal(denied.response.body.error.code, "RATE_LIMITED");
  assert.equal(denied.response.body.error.retryAfter, 42);
  assert.equal(denied.response.headers["Retry-After"], "42");
  assert.deepEqual(limited.rateLimitKeys, [`open-api:client-1:channel:certificates:verify`]);
  assert.equal(limited.rateLimitOptions[0].sensitive, true, "the per-client quota must fail closed without distributed protection");
  assert.equal(limited.auditRows.at(-1).result, "RATE_LIMITED");

  const unavailable = loadOpenApiAuthModule({
    row: machineClientRow(),
    rateLimitResults: { authenticated: { allowed: false, unavailable: true } },
  });
  const unavailableDenied = await unavailable.module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(unavailableDenied.response.status, 503);
  assert.equal(unavailableDenied.response.body.error.code, "SERVICE_UNAVAILABLE");
});

test("unauthenticated attempts are capped and never reach the client table", async () => {
  const savedLimit = process.env.OPEN_API_UNAUTHENTICATED_LIMIT;
  const savedWindow = process.env.OPEN_API_UNAUTHENTICATED_WINDOW_MS;
  delete process.env.OPEN_API_UNAUTHENTICATED_LIMIT;
  delete process.env.OPEN_API_UNAUTHENTICATED_WINDOW_MS;
  try {
    const { module, rateLimitKeys, rateLimitOptions, findFirstCalls } = loadOpenApiAuthModule({
      row: machineClientRow(),
      rateLimitResults: { unauthenticated: { allowed: false, remaining: 0, resetAt: 1_800_000_000_000 } },
    });
    const denied = await module.requireOpenApiKey(bearerRequest(null, {}));
    assert.equal(denied.response.status, 429);
    assert.equal(rateLimitKeys.length, 1);
    assert.match(rateLimitKeys[0], /^open-api:unauthenticated:/);
    assert.equal(rateLimitOptions[0].limit, 20);
    assert.equal(rateLimitOptions[0].windowMs, 60_000);
    assert.equal(rateLimitOptions[0].sensitive, true);
    assert.equal(findFirstCalls.length, 0, "a request without a key must not hit the client lookup");

    const unavailable = loadOpenApiAuthModule({
      row: machineClientRow(),
      rateLimitResults: { unauthenticated: { allowed: false, unavailable: true } },
    });
    const unavailableDenied = await unavailable.module.requireOpenApiKey(bearerRequest(null, {}));
    assert.equal(unavailableDenied.response.status, 503);
    assert.equal(unavailableDenied.response.body.error.code, "SERVICE_UNAVAILABLE");
    assert.equal(unavailable.findFirstCalls.length, 0);
  } finally {
    if (savedLimit === undefined) delete process.env.OPEN_API_UNAUTHENTICATED_LIMIT;
    else process.env.OPEN_API_UNAUTHENTICATED_LIMIT = savedLimit;
    if (savedWindow === undefined) delete process.env.OPEN_API_UNAUTHENTICATED_WINDOW_MS;
    else process.env.OPEN_API_UNAUTHENTICATED_WINDOW_MS = savedWindow;
  }
});

test("the anonymous cap is a deployment number, and a bad value cannot disable it", async () => {
  const saved = process.env.OPEN_API_UNAUTHENTICATED_LIMIT;
  const savedWindow = process.env.OPEN_API_UNAUTHENTICATED_WINDOW_MS;
  try {
    process.env.OPEN_API_UNAUTHENTICATED_LIMIT = "5";
    process.env.OPEN_API_UNAUTHENTICATED_WINDOW_MS = "120000";
    const raised = loadOpenApiAuthModule({ row: machineClientRow() });
    await raised.module.requireOpenApiKey(bearerRequest(null, {}));
    assert.equal(raised.rateLimitOptions[0].limit, 5, "集成测试环境共用同一来源地址，需要上调数值");
    assert.equal(raised.rateLimitOptions[0].windowMs, 120_000);

    process.env.OPEN_API_UNAUTHENTICATED_LIMIT = "not-a-number";
    const garbage = loadOpenApiAuthModule({ row: machineClientRow() });
    await garbage.module.requireOpenApiKey(bearerRequest(null, {}));
    assert.equal(garbage.rateLimitOptions[0].limit, 20, "非法取值退回默认，而不是变成不限流");
  } finally {
    if (saved === undefined) delete process.env.OPEN_API_UNAUTHENTICATED_LIMIT;
    else process.env.OPEN_API_UNAUTHENTICATED_LIMIT = saved;
    if (savedWindow === undefined) delete process.env.OPEN_API_UNAUTHENTICATED_WINDOW_MS;
    else process.env.OPEN_API_UNAUTHENTICATED_WINDOW_MS = savedWindow;
  }
});

test("a rejected credential draws on the anonymous budget and never the client window", async () => {
  const wrongSecret = machineClientRow({ machineKeyBcrypt: hashSync("cpmk_not_the_issued_secret", 4) });
  const gate = loadOpenApiAuthModule({ row: wrongSecret });
  const denied = await gate.module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(denied.response.status, 401);
  jsonEqual(gate.rateLimitKeys, ["open-api:unauthenticated:203.0.113.9"], "guessing keys burns per-address quota, and each guess is one bcrypt at most");
});

test("an unavailable database fails closed instead of authorizing the request", async () => {
  const { module } = loadOpenApiAuthModule({ row: machineClientRow(), prismaUnavailable: true });
  const denied = await module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(denied.ok, false);
  assert.equal(denied.response.status, 503);
  assert.equal(denied.response.body.error.code, "SERVICE_UNAVAILABLE");
});

test("a valid scoped key resolves the client identity and its remaining budget", async () => {
  const { module, auditRows } = loadOpenApiAuthModule({ row: machineClientRow() });
  const gate = await module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(gate.ok, true);
  jsonEqual(gate.client, {
    id: "client-1",
    key: CLIENT_KEY,
    displayName: "Test partner",
    programmeId: "programme-1",
    scopes: ["channel:certificates:verify"],
    allowedOrigins: [],
    allowedIps: [],
    rateLimit: { limit: 60, windowMs: 60_000, configured: false },
    keyMeta: {
      algorithm: "bcrypt",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
      rotatedAt: null,
      lastUsedAt: null,
    },
  });
  assert.equal(gate.rateLimit.limit, 60);
  assert.equal(gate.rateLimit.remaining, 59);
  assert.equal(auditRows.length, 0, "successful calls leave the denial audit empty; the endpoint audits its own domain event");
});

test("audit rows and error bodies never carry key material", async () => {
  for (const row of [null, machineClientRow({ allowedScopes: [] }), machineClientRow({ machineKeyExpiresAt: new Date(Date.now() - 1) })]) {
    const { module, auditRows } = loadOpenApiAuthModule({ row });
    const denied = await module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
    const serialized = JSON.stringify({ bodies: [denied.response.body], auditRows });
    assert.equal(serialized.includes(MACHINE_KEY), false);
    assert.equal(serialized.includes(TOKEN), false);
    assert.equal(serialized.includes(LEGACY_HASH), false);
    assert.equal(serialized.includes(BCRYPT_HASH), false);
    assert.equal(serialized.includes(createHash("sha256").update(MACHINE_KEY, "utf8").digest("hex")), false);
  }
});

test("the client is located by its own key, never by a digest of the secret", async () => {
  const { module, findFirstCalls } = loadOpenApiAuthModule({ row: machineClientRow() });
  await module.requireOpenApiKey(bearerRequest(), { scope: "channel:certificates:verify" });
  assert.equal(findFirstCalls.length, 1);
  jsonEqual(findFirstCalls[0].where, { key: CLIENT_KEY, type: "MACHINE" });
  assert.equal(JSON.stringify(findFirstCalls[0]).includes(MACHINE_KEY), false, "the secret must not reach the query");
});
