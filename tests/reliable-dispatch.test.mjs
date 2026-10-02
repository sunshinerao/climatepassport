/**
 * 源码级测试：可靠 outbox 出站事件（CP-TODO-244 / CP-FR-070）
 *
 * 覆盖（vm/transpile + 内存 Prisma mock）：
 * - hashDispatchPayload：键序无关的规范序列化
 * - enqueueOutboundDispatch：成功；同 key 同内容幂等；同 key 异内容 409
 * - processOutboundDispatches：租约 CAS（PROCESSING 不可重复认领）、成功记回执、
 *   5xx 退避重试、耗尽死信、非重试 4xx 立即死信、无 callbackUrl 死信
 * - reconcileOutboundDispatch：回执登记、重复回执幂等、旧 revision 拒绝
 * - requeueDeadDispatch：仅 DEAD 可重投（CAS）
 * - findDispatchTargets：scope/callback/isActive/type 过滤
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function loadDispatchModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/reliable-dispatch.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    console,
    require: (name) => {
      if (name.startsWith("node:")) return require(name);
      throw new Error(`unexpected import: ${name}`);
    },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const dispatch = loadDispatchModule();

function matches(row, where) {
  return Object.entries(where ?? {}).every(([key, condition]) => {
    if (key === "AND") return condition.every((sub) => matches(row, sub));
    if (key === "OR") return condition.some((sub) => matches(row, sub));
    if (condition !== null && typeof condition === "object") {
      if ("in" in condition) return condition.in.includes(row[key]);
      if ("lte" in condition) return row[key] != null && row[key] <= condition.lte;
      if ("lt" in condition) return row[key] != null && row[key] < condition.lt;
      if ("gt" in condition) return row[key] != null && row[key] > condition.gt;
      if ("not" in condition) return row[key] !== condition.not;
    }
    return row[key] === condition;
  });
}

function makeFake({ dispatches = [], clients = [] } = {}) {
  const fake = {
    outboundDispatch: {
      rows: dispatches,
      create: async ({ data }) => {
        if (dispatches.some((row) => row.idempotencyKey === data.idempotencyKey)) {
          const error = new Error("unique violation");
          error.code = "P2002";
          throw error;
        }
        const row = { id: `d-${dispatches.length + 1}`, attempts: 0, status: "PENDING", ...data };
        dispatches.push(row);
        return row;
      },
      findUnique: async ({ where }) => dispatches.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where, include } = {}) => dispatches.filter((row) => matches(row, where)).map((row) =>
        include?.channelClient
          ? { ...row, channelClient: clients.find((client) => client.id === row.channelClientId) ?? null }
          : row),
      updateMany: async ({ where, data }) => {
        const targets = dispatches.filter((row) => matches(row, where));
        for (const row of targets) {
          for (const [key, value] of Object.entries(data)) {
            row[key] = key === "attempts" && value?.increment !== undefined ? row.attempts + value.increment : value;
          }
        }
        return { count: targets.length };
      },
      update: async ({ where, data }) => {
        const row = dispatches.find((entry) => matches(entry, where));
        if (!row) throw new Error("dispatch not found");
        Object.assign(row, data);
        return row;
      },
    },
    channelClient: {
      rows: clients,
      findMany: async ({ where } = {}) => clients.filter((row) => matches(row, where)),
    },
  };
  return fake;
}

test("hashDispatchPayload is key-order independent", () => {
  const left = dispatch.hashDispatchPayload({ a: 1, b: { c: [1, 2], d: "x" } });
  const right = dispatch.hashDispatchPayload({ b: { d: "x", c: [1, 2] }, a: 1 });
  assert.equal(left, right);
  assert.notEqual(left, dispatch.hashDispatchPayload({ a: 1, b: { c: [1, 2], d: "y" } }));
});

test("enqueueOutboundDispatch dedupes same content and rejects same key with different content", async () => {
  const fake = makeFake();
  const first = await dispatch.enqueueOutboundDispatch(fake, {
    eventType: "certificate.revoked",
    idempotencyKey: "cert:1:revoked:2026-09-19T00:00:00.000Z",
    payload: { certificateIssueId: "1", status: "REVOKED" },
    channelClientId: "c1",
  });
  assert.equal(first.ok, true);
  assert.equal(first.deduplicated, false);

  const replay = await dispatch.enqueueOutboundDispatch(fake, {
    eventType: "certificate.revoked",
    idempotencyKey: "cert:1:revoked:2026-09-19T00:00:00.000Z",
    payload: { status: "REVOKED", certificateIssueId: "1" },
    channelClientId: "c1",
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.deduplicated, true, "same key with same content must deduplicate");
  assert.equal(replay.id, first.id);
  assert.equal(fake.outboundDispatch.rows.length, 1);

  const conflict = await dispatch.enqueueOutboundDispatch(fake, {
    eventType: "certificate.revoked",
    idempotencyKey: "cert:1:revoked:2026-09-19T00:00:00.000Z",
    payload: { certificateIssueId: "1", status: "ISSUED" },
    channelClientId: "c1",
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.status, 409, "same key with different content must conflict");
});

test("processOutboundDispatches claims with lease, records receipts, backs off and dead-letters", async () => {
  const now = new Date("2026-09-19T00:00:00.000Z");
  const fake = makeFake({
    dispatches: [
      { id: "d-ok", eventType: "certificate.revoked", idempotencyKey: "k-ok", payloadHash: "h", revision: 1, payloadJson: { a: 1 }, channelClientId: "c1", status: "PENDING", attempts: 0, maxAttempts: 3, nextRetryAt: now, leaseExpiresAt: null },
      { id: "d-retry", eventType: "certificate.revoked", idempotencyKey: "k-retry", payloadHash: "h", revision: 1, payloadJson: { a: 2 }, channelClientId: "c1", status: "PENDING", attempts: 0, maxAttempts: 3, nextRetryAt: now, leaseExpiresAt: null },
      { id: "d-bad", eventType: "certificate.revoked", idempotencyKey: "k-bad", payloadHash: "h", revision: 1, payloadJson: { a: 3 }, channelClientId: "c1", status: "PENDING", attempts: 0, maxAttempts: 3, nextRetryAt: now, leaseExpiresAt: null },
      { id: "d-nocallback", eventType: "certificate.revoked", idempotencyKey: "k-nc", payloadHash: "h", revision: 1, payloadJson: { a: 4 }, channelClientId: "c2", status: "PENDING", attempts: 0, maxAttempts: 3, nextRetryAt: now, leaseExpiresAt: null },
      { id: "d-leased", eventType: "certificate.revoked", idempotencyKey: "k-leased", payloadHash: "h", revision: 1, payloadJson: { a: 5 }, channelClientId: "c1", status: "PROCESSING", attempts: 1, maxAttempts: 3, nextRetryAt: now, leaseExpiresAt: new Date(now.getTime() + 60_000) },
    ],
    clients: [
      { id: "c1", key: "FSV1OK", isActive: true, type: "MACHINE", callbackUrl: "https://fs.example/hook", allowedScopes: ["dispatch:certificates:lifecycle"] },
      { id: "c2", key: "FSV1NOCB", isActive: true, type: "MACHINE", callbackUrl: null, allowedScopes: ["dispatch:certificates:lifecycle"] },
    ],
  });

  const deliver = async (row) => {
    if (row.id === "d-ok") return { httpStatus: 200, body: "{\"received\":true}", receivedAt: now.toISOString() };
    if (row.id === "d-retry") return { httpStatus: 503, body: "busy", receivedAt: now.toISOString() };
    return { httpStatus: 400, body: "bad request", receivedAt: now.toISOString() };
  };

  const summary = await dispatch.processOutboundDispatches(fake, { now, limit: 10, retryBaseMs: 1_000, deliver });
  assert.equal(summary.claimed, 4, "the leased PROCESSING row must not be re-claimed");
  assert.equal(summary.succeeded, 1);
  assert.equal(summary.retrying, 1);
  assert.equal(summary.dead, 2);

  const ok = fake.outboundDispatch.rows.find((row) => row.id === "d-ok");
  assert.equal(ok.status, "SUCCEEDED");
  assert.equal(ok.receiptJson.httpStatus, 200);
  assert.equal(ok.deliveredAt.getTime(), now.getTime());

  const retry = fake.outboundDispatch.rows.find((row) => row.id === "d-retry");
  assert.equal(retry.status, "PENDING", "5xx stays pending with backoff");
  assert.equal(retry.attempts, 1);
  assert.equal(retry.lastError, "Callback returned 503.");

  const bad = fake.outboundDispatch.rows.find((row) => row.id === "d-bad");
  assert.equal(bad.status, "DEAD", "non-retryable 4xx dead-letters immediately");
  const nocallback = fake.outboundDispatch.rows.find((row) => row.id === "d-nocallback");
  assert.equal(nocallback.status, "DEAD");
});

test("processOutboundDispatches dead-letters after attempts exhaust", async () => {
  const now = new Date("2026-09-19T00:00:00.000Z");
  const fake = makeFake({
    dispatches: [
      { id: "d-flaky", eventType: "certificate.restored", idempotencyKey: "k-flaky", payloadHash: "h", revision: 1, payloadJson: {}, channelClientId: "c1", status: "PENDING", attempts: 2, maxAttempts: 3, nextRetryAt: now, leaseExpiresAt: null },
    ],
    clients: [{ id: "c1", key: "FSV1OK", isActive: true, type: "MACHINE", callbackUrl: "https://fs.example/hook", allowedScopes: ["dispatch:certificates:lifecycle"] }],
  });
  const deliver = async () => ({ httpStatus: 500, body: null, receivedAt: now.toISOString() });
  const summary = await dispatch.processOutboundDispatches(fake, { now, retryBaseMs: 1, deliver });
  assert.equal(summary.dead, 1);
  const row = fake.outboundDispatch.rows[0];
  assert.equal(row.status, "DEAD");
  assert.match(row.lastError, /Attempts exhausted/);
});

test("reconcileOutboundDispatch is idempotent and rejects stale revisions", async () => {
  const fake = makeFake({
    dispatches: [
      { id: "d1", eventType: "certificate.revoked", idempotencyKey: "k1", payloadHash: "h", revision: 2, payloadJson: {}, channelClientId: "c1", status: "SUCCEEDED", attempts: 1, maxAttempts: 3, receiptJson: { httpStatus: 200 }, nextRetryAt: new Date(), leaseExpiresAt: null },
    ],
  });

  const stale = await dispatch.reconcileOutboundDispatch(fake, { id: "d1", receipt: { applied: true }, revision: 1 });
  assert.equal(stale.ok, false);
  assert.equal(stale.status, 409, "older revision must not overwrite newer state");

  const first = await dispatch.reconcileOutboundDispatch(fake, { id: "d1", receipt: { applied: true }, revision: 2 });
  assert.equal(first.ok, true);
  assert.equal(first.applied, true);
  const again = await dispatch.reconcileOutboundDispatch(fake, { id: "d1", receipt: { applied: true }, revision: 2 });
  assert.equal(again.ok, true);
  assert.equal(again.applied, false, "identical receipt must be idempotent");
});

test("requeueDeadDispatch only accepts dead letters", async () => {
  const fake = makeFake({
    dispatches: [
      { id: "d-dead", eventType: "certificate.revoked", idempotencyKey: "k1", payloadHash: "h", revision: 1, payloadJson: {}, channelClientId: "c1", status: "DEAD", attempts: 5, maxAttempts: 5, nextRetryAt: new Date(), leaseExpiresAt: null },
      { id: "d-pending", eventType: "certificate.revoked", idempotencyKey: "k2", payloadHash: "h", revision: 1, payloadJson: {}, channelClientId: "c1", status: "PENDING", attempts: 0, maxAttempts: 5, nextRetryAt: new Date(), leaseExpiresAt: null },
    ],
  });
  const now = new Date("2026-09-19T00:00:10.000Z");
  const ok = await dispatch.requeueDeadDispatch(fake, { id: "d-dead", now });
  assert.equal(ok.ok, true);
  const row = fake.outboundDispatch.rows[0];
  assert.equal(row.status, "PENDING");
  assert.equal(row.attempts, 0);
  assert.equal(row.nextRetryAt.getTime(), now.getTime());

  const notDead = await dispatch.requeueDeadDispatch(fake, { id: "d-pending", now });
  assert.equal(notDead.ok, false);
  assert.equal(notDead.status, 409);
});

test("findDispatchTargets filters by scope, callback, type and active state", async () => {
  const fake = makeFake({
    clients: [
      { id: "c1", key: "FSV1A", isActive: true, type: "MACHINE", callbackUrl: "https://a.example/hook", allowedScopes: ["dispatch:certificates:lifecycle"] },
      { id: "c2", key: "FSV1B", isActive: true, type: "MACHINE", callbackUrl: "https://b.example/hook", allowedScopes: ["channel:certificates:verify"] },
      { id: "c3", key: "FSV1C", isActive: true, type: "MACHINE", callbackUrl: null, allowedScopes: ["dispatch:certificates:lifecycle"] },
      { id: "c4", key: "FSV1D", isActive: true, type: "USER_FACING", callbackUrl: "https://d.example/hook", allowedScopes: ["dispatch:certificates:lifecycle"] },
      { id: "c5", key: "FSV1E", isActive: false, type: "MACHINE", callbackUrl: "https://e.example/hook", allowedScopes: ["dispatch:certificates:lifecycle"] },
    ],
  });
  const targets = await dispatch.findDispatchTargets(fake, "dispatch:certificates:lifecycle");
  assert.deepEqual(targets.map((target) => target.id), ["c1"]);
});
