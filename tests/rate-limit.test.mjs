import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { createRequire } from "node:module";

const source = fs.readFileSync("apps/passport-web/lib/server/rate-limit.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const require = createRequire(import.meta.url);
function load(env = {}, fetchImpl = globalThis.fetch) {
  const sandbox = { exports: {}, module: { exports: {} }, require, process: { env: { ...env } }, fetch: fetchImpl, AbortSignal, Date, Math, Map, console };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox);
  return { api: sandbox.module.exports, sandbox };
}

test("local limiter uses a fixed window and retry delay is bounded", async () => {
  const { api } = load({ RATE_LIMIT_MODE: "local" });
  const first = await api.checkRateLimitAsync("local", { limit: 2, windowMs: 10_000 });
  assert.equal(first.allowed, true);
  assert.equal((await api.checkRateLimitAsync("local", { limit: 2, windowMs: 10_000 })).allowed, true);
  const denied = await api.checkRateLimitAsync("local", { limit: 2, windowMs: 10_000 });
  assert.equal(denied.allowed, false); assert.ok(api.getRateLimitRetryAfter(denied) >= 1);
});
test("subject references partition emails without retaining raw email text", () => {
  const { api } = load();
  const first = api.getRateLimitSubjectReference("first@example.test");
  const second = api.getRateLimitSubjectReference("second@example.test");
  assert.notEqual(first, second);
  assert.equal(first.includes("first@example.test"), false);
  assert.match(first, /^subject-[a-f0-9]{24}$/);
});
test("request key ignores untrusted proxy headers and UA rotation cannot create a new bucket", () => {
  const request = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.5", "x-real-ip": "198.51.100.1", "user-agent": "private raw UA" } });
  const { api } = load({ RATE_LIMIT_TRUST_PROXY: "false" }); const key = api.getRequestRateLimitKey(request, "x");
  const rotated = api.getRequestRateLimitKey(new Request("https://example.test", { headers: { "user-agent": "rotated UA" } }), "x");
  assert.equal(key, "x:source-unattributed"); assert.equal(rotated, key); assert.equal(key.includes("private raw UA"), false); assert.equal(key.includes("203.0.113.5"), false);
});
test("trusted proxy uses a stable opaque reference for the first valid forwarded address", () => {
  const { api } = load({ RATE_LIMIT_TRUST_PROXY: "true" });
  const key = api.getRequestRateLimitKey(new Request("https://example.test", { headers: { "x-forwarded-for": "not-an-ip, 2001:DB8::1", "user-agent": "x" } }), "x");
  const rotated = api.getRequestRateLimitKey(new Request("https://example.test", { headers: { "x-forwarded-for": "2001:db8::1", "user-agent": "y" } }), "x");
  assert.match(key, /^x:subject-[a-f0-9]{24}$/); assert.equal(rotated, key); assert.equal(key.includes("2001:db8::1"), false);
});
test("shared mode constructs an authenticated Upstash REST eval request and maps denial", async () => {
  let call; const { api } = load({ NODE_ENV: "production", RATE_LIMIT_MODE: "shared", RATE_LIMIT_REST_URL: "https://redis.test/", RATE_LIMIT_REST_TOKEN: "secret" }, async (...args) => { call = args; return new Response(JSON.stringify({ result: [4, 2500] }), { status: 200 }); });
  const result = await api.checkRateLimitAsync("key", { limit: 3, windowMs: 9_000, sensitive: true });
  assert.equal(result.allowed, false); assert.equal(call[0], "https://redis.test/eval"); assert.equal(call[1].headers.Authorization, "Bearer secret");
  const body = JSON.parse(call[1].body); assert.equal(body[1], 1); assert.equal(body[2], "key"); assert.equal(body[3], "9000"); assert.match(body[0], /INCR/); assert.match(body[0], /PEXPIRE/);
});
test("shared production sensitive errors fail closed while development falls back locally", async () => {
  const failedFetch = async () => { throw new Error("network"); };
  const production = load({ NODE_ENV: "production", RATE_LIMIT_MODE: "shared", RATE_LIMIT_REST_URL: "https://redis.test", RATE_LIMIT_REST_TOKEN: "secret" }, failedFetch);
  const closed = await production.api.checkRateLimitAsync("key", { limit: 1, windowMs: 1000, sensitive: true }); assert.equal(closed.unavailable, true); assert.equal(closed.allowed, false);
  const development = load({ NODE_ENV: "development", RATE_LIMIT_MODE: "shared", RATE_LIMIT_REST_URL: "https://redis.test", RATE_LIMIT_REST_TOKEN: "secret" }, failedFetch);
  assert.equal((await development.api.checkRateLimitAsync("key", { limit: 1, windowMs: 1000, sensitive: true })).allowed, true);
});
test("production auto/shared modes require shared protection for sensitive requests while explicit local remains an override", async () => {
  assert.equal((await load({ NODE_ENV: "production", RATE_LIMIT_MODE: "shared" }).api.checkRateLimitAsync("x", { limit: 1, windowMs: 1, sensitive: true })).unavailable, true);
  assert.equal((await load({ NODE_ENV: "production", RATE_LIMIT_MODE: "auto" }).api.checkRateLimitAsync("x", { limit: 1, windowMs: 1, sensitive: true })).unavailable, true);
  assert.equal((await load({ NODE_ENV: "production", RATE_LIMIT_MODE: "local" }).api.checkRateLimitAsync("x", { limit: 1, windowMs: 1, sensitive: true })).allowed, true);
});
