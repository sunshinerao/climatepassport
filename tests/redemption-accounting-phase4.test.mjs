import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const require = createRequire(import.meta.url);

function loadService(prisma) {
  const sourcePath = path.resolve("apps/passport-web/lib/server/redemption-accounting.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require: (name) => {
    if (name === "@prisma/client") return { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } };
    if (name === "@/lib/server/prisma") return { getPrismaClient: () => prisma };
    return require(name);
  } };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

test("Phase 4 redemption schema is additive and protects positive, idempotent restricted accounting records", async () => {
  const [schema, migration] = await Promise.all([read("prisma/schema.prisma"), read("prisma/migrations/20260913110000_redemption_accounting_phase4/migration.sql")]);
  assert.match(schema, /model RedemptionIntent/);
  assert.match(schema, /USER_AVAILABLE/);
  assert.match(schema, /@@unique\(\[userId, idempotencyKey\]\)/);
  assert.match(schema, /idempotencyKey String\s+@unique/);
  assert.match(schema, /onDelete: Restrict/);
  assert.match(migration, /CHECK \("points" > 0\)/);
  assert.match(migration, /CREATE TABLE "point_postings"/);
  assert.doesNotMatch(migration, /DROP |ALTER TABLE "users"/i);
});

test("service has serializable bounded retries, all state transitions, paired postings, and no legacy ledger mutation", async () => {
  const service = await read("apps/passport-web/lib/server/redemption-accounting.ts");
  for (const operation of ["createRedemptionIntent", "reserveRedemptionIntent", "cancelRedemptionIntent", "expireRedemptionIntent", "settleRedemptionIntent", "refundRedemptionIntent", "getAvailableRedemptionPoints"]) assert.match(service, new RegExp(operation));
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /attempt < 3/);
  assert.match(service, /createMany[\s\S]*redemptionPostingPairs/);
  assert.match(service, /availablePointsFromLegacyBalance\(user\.points, postings\)/);
  assert.match(service, /ADMIN_ONLY/);
  assert.doesNotMatch(service, /pointTransaction\.|user\.update[\s\S]*points:/);
});

test("actual posting-pair helper implements approved zero-sum debit-credit accounting", () => {
  const service = loadService(null);
  const cases = {
    reserve: [["USER_AVAILABLE", "DEBIT"], ["USER_RESERVED", "CREDIT"]],
    cancel: [["USER_RESERVED", "DEBIT"], ["USER_AVAILABLE", "CREDIT"]],
    expire: [["USER_RESERVED", "DEBIT"], ["USER_AVAILABLE", "CREDIT"]],
    settle: [["USER_RESERVED", "DEBIT"], ["REDEMPTION_CLEARING", "CREDIT"]],
    refund: [["REDEMPTION_CLEARING", "DEBIT"], ["USER_AVAILABLE", "CREDIT"]],
  };
  for (const [operation, expected] of Object.entries(cases)) {
    const postings = service.redemptionPostingPairs(operation);
    assert.equal(JSON.stringify(postings.map(({ account, direction }) => [account, direction])), JSON.stringify(expected));
    assert.equal(postings.filter((posting) => posting.direction === "DEBIT").length, 1);
    assert.equal(postings.filter((posting) => posting.direction === "CREDIT").length, 1);
  }
});

test("actual available calculation uses legacy balance minus only net reserved credits", () => {
  const service = loadService(null);
  const reserve = service.redemptionPostingPairs("reserve").map((posting) => ({ ...posting, points: 30 }));
  const cancel = service.redemptionPostingPairs("cancel").map((posting) => ({ ...posting, points: 30 }));
  const settle = service.redemptionPostingPairs("settle").map((posting) => ({ ...posting, points: 30 }));
  const refund = service.redemptionPostingPairs("refund").map((posting) => ({ ...posting, points: 30 }));
  const reservedOnly = (postings) => postings.filter((posting) => posting.account === "USER_RESERVED");
  assert.equal(service.availablePointsFromLegacyBalance(100, reservedOnly(reserve)), 70);
  assert.equal(service.availablePointsFromLegacyBalance(100, reservedOnly([...reserve, ...cancel])), 100);
  assert.equal(service.availablePointsFromLegacyBalance(100, reservedOnly([...reserve, ...settle])), 100);
  assert.equal(service.availablePointsFromLegacyBalance(100, reservedOnly([...reserve, ...settle, ...refund])), 100);
  // USER_AVAILABLE is deliberately excluded while User.points is the legacy base.
  assert.equal(service.availablePointsFromLegacyBalance(100, reservedOnly(reserve)), 70);
});

test("actual transition returns existing journal idempotently without writes", async () => {
  let writes = 0;
  const existingIntent = { id: "intent-1", userId: "user-1", status: "RESERVED", points: 10 };
  const service = loadService({ $transaction: async (work) => work({
    pointJournal: { findUnique: async () => ({ id: "journal-1", intent: existingIntent }) },
    redemptionIntent: { findUnique: async () => { writes += 1; } },
    pointPosting: { createMany: async () => { writes += 1; } },
  }) });
  const result = await service.cancelRedemptionIntent({ actor: { userId: "user-1", role: "ATTENDEE" }, intentId: "intent-1", idempotencyKey: "cancel-1" });
  assert.equal(result.idempotent, true);
  assert.equal(result.intent, existingIntent);
  assert.equal(writes, 0);
});

test("actual serializable wrapper retries a transaction conflict once", async () => {
  let attempts = 0;
  const service = loadService({ $transaction: async (work, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    attempts += 1;
    if (attempts === 1) { const error = new Error("conflict"); error.code = "P2034"; throw error; }
    return work({ user: { findUnique: async () => ({ points: 25 }) }, pointPosting: { findMany: async () => [] } });
  } });
  assert.equal(await service.getAvailableRedemptionPoints({ userId: "user-1", role: "ATTENDEE" }, "user-1"), 25);
  assert.equal(attempts, 2);
});

test("service confines audit and in-app metadata to accounting identifiers, states, and points and registers no provider", async () => {
  const service = await read("apps/passport-web/lib/server/redemption-accounting.ts");
  assert.match(service, /coreAuditLog\.create/);
  assert.match(service, /channel: "IN_APP"/);
  assert.match(service, /const metadata = \{ intentId: input\.intentId, operation: input\.operation, points: input\.points, status: input\.status \}/);
  assert.match(service, /redemptionProviderAdapters = Object\.freeze\(\{\}\)/);
  assert.doesNotMatch(service, /fetch\(|https?:\/\/|webhook|provider.*call/i);
});
