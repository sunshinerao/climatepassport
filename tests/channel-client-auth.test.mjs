/**
 * 源码级测试：渠道机器客户端认证与登记生命周期（CP-TODO-243 / CP-FR-069）
 *
 * 覆盖（真实依赖链 + 内存 Prisma mock）：
 * - authenticateChannelMachine：未知/停用/非 MACHINE 客户端 401 UNKNOWN_CLIENT；
 *   密钥不匹配或未配置 401 MACHINE_AUTH_FAILED；密钥过期 403 MACHINE_KEY_EXPIRED；
 *   scope 不允许 403；带 Origin 必须命中 allowlist（空白名单同样拒绝）403；
 *   无 Origin 时按 allowedIps 判定，白名单非空却无从归因则 fail-closed
 * - readMachineCredentials：双头齐全/缺一/全无三种形态
 * - registerChannelClient：scope/origin/IP/配额/有效期逐项校验；USER_FACING 不得带 machineKey；
 *   重复 key 409；MACHINE 成功时明文只出现一次、库中存 bcrypt 摘要、同时给出
 *   `<clientKey>.<machineKey>` 形态的 Open API 凭据；创建审计同事务
 * - rotateChannelClientKey：换发新机密、清空遗留 sha256 摘要、旧 key 立即失效
 * - updateChannelClient：scope/origin/IP/配额校验、已撤销 409、审计
 * - revokeChannelClient：compare-and-set，二次撤销 409，落 revokedAt/revokeReason，审计
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { loadServerModule } from "./_route-loader.mjs";

const require = createRequire(import.meta.url);
const { hashSync, compareSync } = require("bcryptjs");

const auth = loadServerModule("@/lib/server/channel-client-auth");

/** The module under test runs in a vm realm, so compare plain structures instead of prototypes. */
function jsonEqual(actual, expected, message) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message);
}

/** Cost 4 keeps the suite fast; the shape of the storage, not its strength, is under test here. */
function bcrypt(secret) {
  return hashSync(secret, 4);
}

function makeFake(clients) {
  const audits = [];
  const fake = {
    channelClient: {
      findFirst: async ({ where }) => clients.find((row) =>
        row.key === where.key
        && row.isActive === where.isActive
        && row.type === where.type
        && row.programme?.isActive === true) ?? null,
      findUnique: async ({ where }) => clients.find((row) => row.id === where.id) ?? null,
      create: async ({ data }) => {
        if (clients.some((row) => row.key === data.key)) {
          const error = new Error("unique violation");
          error.code = "P2002";
          throw error;
        }
        const row = { id: `client-${clients.length + 1}`, isActive: true, ...data };
        clients.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = clients.find((entry) => entry.id === where.id);
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const staleEnough = (row) => {
          if (!where.OR) return true;
          return row.machineKeyLastUsedAt == null || row.machineKeyLastUsedAt < where.OR[1].machineKeyLastUsedAt.lt;
        };
        const targets = clients.filter((row) => row.id === where.id && (where.isActive === undefined || row.isActive === where.isActive) && staleEnough(row));
        targets.forEach((row) => Object.assign(row, data));
        return { count: targets.length };
      },
    },
    programme: { findFirst: async ({ where }) => ({ id: where.id }) },
    coreAuditLog: { create: async ({ data }) => { audits.push(data); return { id: `audit-${audits.length}` }; } },
    $transaction: async (callback) => callback(fake),
    audits,
  };
  return fake;
}

function machineRow(overrides = {}) {
  return {
    id: "c1",
    key: "FSV1GOOD",
    displayName: "FS",
    type: "MACHINE",
    programmeId: "p1",
    isActive: true,
    programme: { isActive: true },
    machineKeyHash: null,
    machineKeyBcrypt: null,
    machineKeyExpiresAt: null,
    allowedScopes: ["channel:certificates:verify"],
    allowedOrigins: ["https://fs.example"],
    allowedIps: [],
    ...overrides,
  };
}

const SECRET = "cpmk_super_secret_value";

test("authenticateChannelMachine is fail-closed across the full negative matrix", async () => {
  const clients = [
    machineRow({ machineKeyBcrypt: bcrypt(SECRET) }),
    machineRow({ id: "c2", key: "FSV1NOSCOPE", displayName: "FS no scope", machineKeyBcrypt: bcrypt("cpmk_key_b"), allowedScopes: ["channel:session:bridge"], allowedOrigins: [] }),
    machineRow({ id: "c3", key: "FSV1NOKEY", displayName: "FS no key", allowedOrigins: [] }),
    machineRow({ id: "c4", key: "FSV1USER", displayName: "FS user-facing", type: "USER_FACING", machineKeyBcrypt: bcrypt("cpmk_key_c"), allowedOrigins: [] }),
    machineRow({ id: "c5", key: "FSV1OFF", displayName: "FS revoked", isActive: false, machineKeyBcrypt: bcrypt("cpmk_key_d"), allowedOrigins: [] }),
    machineRow({ id: "c6", key: "FSV1EXPIRED", displayName: "FS expired", machineKeyBcrypt: bcrypt("cpmk_key_e"), machineKeyExpiresAt: new Date(Date.now() - 1) }),
    machineRow({ id: "c7", key: "FSV1LEGACY", displayName: "FS legacy sha256 row", machineKeyHash: auth.hashChannelMachineKey("legacy-secret") }),
  ];
  const fake = makeFake(clients);

  const ok = await auth.authenticateChannelMachine(fake, { clientKey: "FSV1GOOD", machineKey: SECRET, requiredScope: "channel:certificates:verify", origin: "https://fs.example" });
  assert.equal(ok.ok, true);
  assert.equal(ok.client.key, "FSV1GOOD");
  assert.equal(ok.client.programmeId, "p1");
  assert.equal((await auth.authenticateChannelMachine(fake, { clientKey: "FSV1LEGACY", machineKey: "legacy-secret", requiredScope: "channel:certificates:verify", origin: "https://fs.example" })).ok, true, "pre-migration rows keep verifying until rotation retires the digest");

  for (const [label, input, expected] of [
    ["unknown client", { clientKey: "FSV1UNKNOWN" }, ["UNKNOWN_CLIENT", 401]],
    ["revoked client", { clientKey: "FSV1OFF", machineKey: "cpmk_key_d" }, ["UNKNOWN_CLIENT", 401]],
    ["user-facing client", { clientKey: "FSV1USER", machineKey: "cpmk_key_c" }, ["UNKNOWN_CLIENT", 401]],
    ["wrong secret", { clientKey: "FSV1GOOD", machineKey: "cpmk_wrong_wrong_wrong" }, ["MACHINE_AUTH_FAILED", 401]],
    ["no secret configured", { clientKey: "FSV1NOKEY", machineKey: "anything_at_all_here" }, ["MACHINE_AUTH_FAILED", 401]],
    ["missing scope", { clientKey: "FSV1NOSCOPE", machineKey: "cpmk_key_b" }, ["SCOPE_DENIED", 403]],
    ["expired key", { clientKey: "FSV1EXPIRED", machineKey: "cpmk_key_e" }, ["MACHINE_KEY_EXPIRED", 403]],
    ["unlisted origin", { clientKey: "FSV1GOOD", machineKey: SECRET, origin: "https://evil.example" }, ["ORIGIN_DENIED", 403]],
    ["scope is judged before the origin", { clientKey: "FSV1NOSCOPE", machineKey: "cpmk_key_b", origin: "https://fs.example" }, ["SCOPE_DENIED", 403]],
  ]) {
    const result = await auth.authenticateChannelMachine(fake, {
      requiredScope: "channel:certificates:verify",
      origin: "https://fs.example",
      machineKey: SECRET,
      clientKey: "FSV1GOOD",
      ...input,
    });
    assert.equal(result.ok, false, label);
    assert.equal(result.code, expected[0], label);
    assert.equal(result.status, expected[1], label);
  }
});

test("a browser Origin is refused outright when the key allowlists none", async () => {
  // c2/c3/c4/c5 above all carry an empty allowlist; a server-to-server key must not be
  // reachable from a browser just because nobody bothered to list origins.
  const fake = makeFake([machineRow({ key: "FSV1NOORIGIN", allowedOrigins: [], machineKeyBcrypt: bcrypt(SECRET) })]);
  const denied = await auth.authenticateChannelMachine(fake, { clientKey: "FSV1NOORIGIN", machineKey: SECRET, requiredScope: "channel:certificates:verify", origin: "https://fs.example" });
  jsonEqual({ code: denied.code, status: denied.status }, { code: "ORIGIN_DENIED", status: 403 });
  assert.equal((await auth.authenticateChannelMachine(fake, { clientKey: "FSV1NOORIGIN", machineKey: SECRET, requiredScope: "channel:certificates:verify", origin: null })).ok, true, "the same key still works server-to-server");
});

test("an Origin-less caller is judged by the address allowlist", async () => {
  const fake = makeFake([machineRow({ allowedOrigins: [], allowedIps: ["198.51.100.4"], machineKeyBcrypt: bcrypt(SECRET) })]);
  const base = { clientKey: "FSV1GOOD", machineKey: SECRET, requiredScope: "channel:certificates:verify", origin: null };

  assert.equal((await auth.authenticateChannelMachine(fake, { ...base, clientIp: "198.51.100.4" })).ok, true, "an allowlisted address passes");
  jsonEqual(await auth.authenticateChannelMachine(fake, { ...base, clientIp: "203.0.113.9" }), { ok: false, status: 403, code: "IP_DENIED" });
  assert.equal((await auth.authenticateChannelMachine(fake, base)).code, "IP_DENIED", "a non-empty allowlist with no resolvable address fails closed");

  const unconstrained = makeFake([machineRow({ allowedOrigins: [], machineKeyBcrypt: bcrypt(SECRET) })]);
  assert.equal((await auth.authenticateChannelMachine(unconstrained, base)).ok, true, "an empty allowlist adds no constraint beyond the key itself");
});

test("last-used bookkeeping is throttled and never changes the auth verdict", async () => {
  const fresh = machineRow({ machineKeyBcrypt: bcrypt(SECRET), machineKeyLastUsedAt: new Date() });
  const fake = makeFake([fresh]);
  const before = fresh.machineKeyLastUsedAt;
  assert.equal((await auth.authenticateChannelMachine(fake, { clientKey: "FSV1GOOD", machineKey: SECRET, requiredScope: "channel:certificates:verify", origin: "https://fs.example" })).ok, true);
  assert.equal(fresh.machineKeyLastUsedAt, before, "a hot key writes at most once per interval");

  const stale = machineRow({ id: "c2", key: "FSV1GOOD2", machineKeyBcrypt: bcrypt(SECRET), machineKeyLastUsedAt: new Date(Date.now() - 120_000) });
  const staleFake = makeFake([stale]);
  assert.equal((await auth.authenticateChannelMachine(staleFake, { clientKey: "FSV1GOOD2", machineKey: SECRET, requiredScope: "channel:certificates:verify", origin: "https://fs.example" })).ok, true);
  assert.equal(stale.machineKeyLastUsedAt > Date.now() - 5_000, true, "a stale row gets refreshed");

  const never = machineRow({ id: "c3", key: "FSV1GOOD3", machineKeyBcrypt: bcrypt(SECRET) });
  const neverFake = makeFake([never]);
  await auth.authenticateChannelMachine(neverFake, { clientKey: "FSV1GOOD3", machineKey: SECRET, requiredScope: "channel:certificates:verify", origin: "https://fs.example" });
  assert.equal(never.machineKeyLastUsedAt instanceof Date, true);

  const broken = makeFake([machineRow({ machineKeyBcrypt: bcrypt(SECRET) })]);
  broken.channelClient.updateMany = async () => {
    throw new Error("write conflict");
  };
  assert.equal((await auth.authenticateChannelMachine(broken, { clientKey: "FSV1GOOD", machineKey: SECRET, requiredScope: "channel:certificates:verify", origin: "https://fs.example" })).ok, true, "usage bookkeeping must never become an availability risk");
});

test("readMachineCredentials distinguishes absent, partial, and full credentials", () => {
  const makeHeaders = (entries) => new Map(Object.entries(entries));
  assert.equal(auth.readMachineCredentials(makeHeaders({})), null);
  const partial = auth.readMachineCredentials(makeHeaders({ "x-channel-client-key": "FSV1" }));
  assert.equal(partial.clientKey, "FSV1");
  assert.equal(partial.machineKey, "");
  const full = auth.readMachineCredentials(makeHeaders({ "x-channel-client-key": "FSV1", "x-channel-machine-key": "secret" }));
  assert.equal(full.clientKey, "FSV1");
  assert.equal(full.machineKey, "secret");
});

test("the Open API credential carries its own client key because bcrypt cannot be looked up", () => {
  const secret = "cpmk_abcdefghijklmnopqrstuvwxyz012345";
  jsonEqual(auth.parseOpenApiKey(auth.formatOpenApiKey("FSV1GOOD", secret)), { clientKey: "FSV1GOOD", machineKey: secret });
  assert.equal(auth.parseOpenApiKey(secret), null, "a bare secret cannot locate the client");
  assert.equal(auth.parseOpenApiKey("FSV1GOOD."), null);
  assert.equal(auth.parseOpenApiKey(".cpmk_x"), null);
  assert.equal(auth.parseOpenApiKey(`FSV1GOOD.cpmk_${"x".repeat(80)}`), null, "bcrypt truncates past 72 bytes");
});

test("registerChannelClient validates policy and stores only a bcrypt digest", async () => {
  const base = { displayName: "FS", type: "MACHINE", programmeId: "p1", allowedOrigins: [], allowedScopes: ["channel:certificates:verify"], actorUserId: "admin" };
  const rejections = [
    ["unknown scope", { allowedScopes: ["channel:admin:everything"] }],
    ["insecure origin", { allowedOrigins: ["http://fs.example"] }],
    ["unparseable CIDR", { allowedIps: ["198.51.100.0/300"] }],
    ["quota without a window", { rateLimitLimit: 500 }],
    ["window without a quota", { rateLimitWindowMs: 60_000 }],
    ["quota above the bound", { rateLimitLimit: 10_000_000, rateLimitWindowMs: 60_000 }],
    ["validity above the ceiling", { expiresInDays: 5_000 }],
    ["secret without the prefix", { machineKey: "sk-letters-but-not-the-prefix" }],
    ["secret past the bcrypt ceiling", { machineKey: `cpmk_${"x".repeat(80)}` }],
    ["user-facing carrying a secret", { type: "USER_FACING", allowedScopes: ["channel:session:bridge"], machineKey: "cpmk_should-not-be-here" }],
  ];
  for (const [label, patch] of rejections) {
    const clients = [];
    const fake = makeFake(clients);
    const result = await auth.registerChannelClient(fake, { ...base, ...patch });
    assert.equal(result.status, 400, label);
    assert.equal(clients.length, 0, `${label}: nothing persists while validation fails`);
    assert.equal(JSON.stringify(result).includes(patch.machineKey ?? "cpmk_super"), false, `${label}: the rejection never echoes the supplied secret`);
  }

  const fake = makeFake([]);
  const quota = await auth.registerChannelClient(fake, { ...base, rateLimitLimit: 500, rateLimitWindowMs: 60_000 });
  assert.equal(quota.created, true, "a quota pair inside the bounds is accepted");
  jsonEqual((await fake.channelClient.findUnique({ where: { id: quota.client.id } })).rateLimitLimit ?? null, 500);

  const ok = await auth.registerChannelClient(fake, {
    key: "FSV1TEST", displayName: "FS Test", type: "MACHINE", programmeId: "p1",
    allowedOrigins: ["https://fs.example"], allowedScopes: ["channel:certificates:verify"],
    allowedIps: ["198.51.100.0/30"], actorUserId: "admin",
  });
  assert.equal(ok.created, true);
  assert.equal(ok.client.key, "FSV1TEST");
  assert.ok(ok.machineKey.startsWith("cpmk_"), "server issues the machine key when none is provided");
  assert.equal(ok.openApiKey, `FSV1TEST.${ok.machineKey}`, "the caller gets one paste-ready Open API credential");
  assert.equal(ok.machineKeyExpiresAt.getTime() - Date.now() > 364 * 86_400_000, true, "a fresh key expires by default");

  const stored = await fake.channelClient.findUnique({ where: { id: ok.client.id } });
  assert.equal(stored.machineKeyHash ?? null, null, "new rows never carry the unsalted legacy digest");
  assert.equal(compareSync(ok.machineKey, stored.machineKeyBcrypt), true, "the stored value is a bcrypt digest of the issued secret");
  assert.equal(JSON.stringify(stored).includes(ok.machineKey), false, "plaintext machine key must never be persisted");
  jsonEqual(stored.allowedIps, ["198.51.100.0/30"]);
  assert.equal(fake.audits.length, 2);
  assert.equal(fake.audits[1].action, "channel_client.register");
  assert.equal(fake.audits[1].metadataJson.machineKeyAlgorithm, "bcrypt");
  assert.equal(JSON.stringify(fake.audits[1]).includes(ok.machineKey), false, "the audit row never carries the secret");
  assert.equal(JSON.stringify(fake.audits[1]).includes(stored.machineKeyBcrypt), false, "nor its digest");

  assert.equal((await auth.registerChannelClient(fake, { ...base, key: "FSV1TEST" })).status, 409);
});

test("rotateChannelClientKey replaces the secret and voids the legacy digest", async () => {
  const fake = makeFake([]);
  const created = await auth.registerChannelClient(fake, {
    key: "FSV1ROT", displayName: "FS Rotate", type: "MACHINE", programmeId: "p1",
    allowedOrigins: [], allowedScopes: ["channel:certificates:verify"], actorUserId: "admin",
  });
  const row = await fake.channelClient.findUnique({ where: { id: created.client.id } });
  row.machineKeyHash = auth.hashChannelMachineKey(created.machineKey);

  const rotated = await auth.rotateChannelClientKey(fake, { id: created.client.id, actorUserId: "admin", expiresInDays: 30, reason: "leaked" });
  assert.equal(rotated.client.id, created.client.id);
  assert.ok(rotated.machineKey.startsWith("cpmk_"));
  assert.notEqual(rotated.machineKey, created.machineKey);
  assert.equal(rotated.openApiKey, `FSV1ROT.${rotated.machineKey}`);
  assert.equal(rotated.machineKeyExpiresAt.getTime() - Date.now() < 31 * 86_400_000, true);

  const stored = await fake.channelClient.findUnique({ where: { id: created.client.id } });
  assert.equal(stored.machineKeyHash, null, "rotation must retire the legacy digest or it stays guessable");
  assert.equal(compareSync(created.machineKey, stored.machineKeyBcrypt), false);
  assert.equal(compareSync(rotated.machineKey, stored.machineKeyBcrypt), true);
  assert.equal(stored.machineKeyRotatedAt instanceof Date, true);
  assert.equal(fake.audits.at(-1).action, "channel_client.rotate_key");
  assert.equal(fake.audits.at(-1).metadataJson.reason, "leaked");
  assert.equal(JSON.stringify(fake.audits.at(-1)).includes(rotated.machineKey), false);

  assert.equal((await auth.rotateChannelClientKey(fake, { id: created.client.id, actorUserId: "admin", expiresInDays: 0 })).status, 400);
  assert.equal((await auth.rotateChannelClientKey(fake, { id: "missing", actorUserId: "admin" })).status, 404);
  const userFacing = await auth.registerChannelClient(fake, {
    key: "FSV1UF", displayName: "FS UF", type: "USER_FACING", programmeId: "p1",
    allowedOrigins: [], allowedScopes: ["channel:session:bridge"], actorUserId: "admin",
  });
  assert.equal((await auth.rotateChannelClientKey(fake, { id: userFacing.client.id, actorUserId: "admin" })).status, 400, "a user-facing client has no machine secret to rotate");
});

test("updateChannelClient validates policy changes and keeps the audit trail", async () => {
  const fake = makeFake([]);
  const created = await auth.registerChannelClient(fake, {
    key: "FSV1UPD", displayName: "FS Update", type: "MACHINE", programmeId: "p1",
    allowedOrigins: ["https://fs.example"], allowedScopes: ["channel:certificates:verify"], actorUserId: "admin",
  });

  assert.equal((await auth.updateChannelClient(fake, { id: created.client.id, allowedScopes: ["channel:unknown"], actorUserId: "admin" })).status, 400);
  assert.equal((await auth.updateChannelClient(fake, { id: created.client.id, allowedOrigins: ["https://fs.example/x"], actorUserId: "admin" })).status, 400, "an origin must not carry a path");
  assert.equal((await auth.updateChannelClient(fake, { id: created.client.id, allowedIps: ["not-an-ip"], actorUserId: "admin" })).status, 400);
  assert.equal((await auth.updateChannelClient(fake, { id: created.client.id, rateLimitLimit: null, rateLimitWindowMs: 60_000, actorUserId: "admin" })).status, 400);

  const ok = await auth.updateChannelClient(fake, {
    id: created.client.id, allowedOrigins: ["https://fs2.example"], allowedIps: ["198.51.100.7"],
    rateLimitLimit: 90, rateLimitWindowMs: 120_000, actorUserId: "admin",
  });
  assert.equal(ok.client.key, "FSV1UPD");
  const stored = await fake.channelClient.findUnique({ where: { id: created.client.id } });
  jsonEqual(stored.allowedOrigins, ["https://fs2.example"]);
  jsonEqual(stored.allowedIps, ["198.51.100.7"]);
  assert.equal(stored.rateLimitLimit, 90);
  assert.equal(fake.audits.at(-1).action, "channel_client.update");
  jsonEqual(fake.audits.at(-1).metadataJson.rateLimit, { limit: 90, windowMs: 120_000 });

  const reset = await auth.updateChannelClient(fake, { id: created.client.id, rateLimitLimit: null, rateLimitWindowMs: null, actorUserId: "admin" });
  assert.equal(reset.client.key, "FSV1UPD");
  assert.equal((await fake.channelClient.findUnique({ where: { id: created.client.id } })).rateLimitLimit, null, "a quota pair sent as null falls back to the server default");

  const revoked = await auth.revokeChannelClient(fake, { id: created.client.id, actorUserId: "admin", reason: "partner offboarded" });
  assert.equal(revoked.client.id, created.client.id);
  const revokedRow = await fake.channelClient.findUnique({ where: { id: created.client.id } });
  assert.equal(revokedRow.isActive, false);
  assert.equal(revokedRow.revokeReason, "partner offboarded");
  assert.equal(revokedRow.revokedAt instanceof Date, true);
  assert.equal(fake.audits.at(-1).action, "channel_client.revoke");
  assert.equal(fake.audits.at(-1).metadataJson.reason, "partner offboarded");

  assert.equal((await auth.revokeChannelClient(fake, { id: created.client.id, actorUserId: "admin" })).status, 409);
  assert.equal((await auth.updateChannelClient(fake, { id: created.client.id, displayName: "Nope", actorUserId: "admin" })).status, 409, "a revoked client is not editable");
  assert.equal((await auth.rotateChannelClientKey(fake, { id: created.client.id, actorUserId: "admin" })).status, 409, "a revoked client cannot be brought back by rotation");
});

test("IP allowlist parsing rejects the shapes that would silently match nothing", () => {
  assert.equal(auth.validateAllowedIps(["198.51.100.7", "198.51.100.0/30", "2001:db8::5", "2001:db8::/32"]), null);
  assert.match(auth.validateAllowedIps(["198.51.100"]), /Invalid IP or CIDR/);
  assert.match(auth.validateAllowedIps(["198.51.100.7/300"]), /Invalid IP or CIDR/);
  assert.match(auth.validateAllowedIps(["https://198.51.100.7"]), /Invalid IP or CIDR/);
  assert.match(auth.validateAllowedIps(["2001:db8::/129"]), /Invalid IP or CIDR/);
  assert.match(auth.validateAllowedIps(Array.from({ length: 51 }, (_, index) => `198.51.100.${index}`)), /at most 50/);
});
