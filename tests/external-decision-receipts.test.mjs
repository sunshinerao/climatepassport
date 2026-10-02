/**
 * 源码级测试：外部审核/反馈决定的最小回执（CP-TODO-250 / CP-FR-059）
 *
 * 覆盖（vm 沙箱 + 内存 Prisma mock）：
 * - hashReceiptContent：minimalJson（含嵌套对象/数组）键序无关，内容变更哈希变更
 * - receiveDecisionReceipt：正常入库 contentHash/validUntil 落库，审计 decision_receipt.receive
 * - 校验：validUntil 过去 400 INVALID_REQUEST；objectRevision < 1 400，均不入库不写审计
 * - 陈旧：已有更新 revision 后提交旧 revision → 409 RECEIPT_STALE，不新增行（符合预期）
 * - 同键异内容 → 409 RECEIPT_CONFLICT，不新增行（符合预期）
 * - findAuthoritativeReceipt：最新 APPROVED 返回；最新 REVOKED 覆盖旧批准 → null；
 *   validUntil 过期 → null；minRevision 不满足 → null；purpose 过滤互不混淆
 * - listDecisionReceipts：objectType/objectId/purpose/issuerKey 过滤
 *
 * - 幂等去重：同键同内容重放 → deduplicated=true 不新增行不重复审计；
 *   同 revision 同内容换键 → deduplicated=true（contentHash 只覆盖 7 个
 *   内容字段，idempotencyKey/signature/validUntil 不参与哈希）
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadService, matchesWhere } from "./_service-loader.mjs";

const receipts = loadService("apps/passport-web/lib/server/external-decision-receipts.ts");

const BASE_TIME = 1_800_000_000_000; // 固定基准，保证 create 的 receivedAt 单调递增

function sortRows(rows, orderBy = []) {
  const valueOf = (v) => (v instanceof Date ? v.getTime() : v);
  return [...rows].sort((a, b) => {
    for (const clause of orderBy) {
      for (const [key, dir] of Object.entries(clause)) {
        const av = valueOf(a[key]);
        const bv = valueOf(b[key]);
        if (av === bv) continue;
        const cmp = av < bv ? -1 : 1;
        return dir === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function makeFake({ receipts: seeded = [] } = {}) {
  const state = {
    receipts: seeded.map((row, index) => ({
      id: `seed-${index + 1}`,
      issuerKey: "FSV1",
      programmeId: null,
      objectType: "paper",
      objectId: "p1",
      objectRevision: 1,
      purpose: "publication_approval",
      decision: "APPROVED",
      minimalJson: {},
      signature: null,
      idempotencyKey: `seed-${index + 1}`,
      contentHash: `hash-${index + 1}`,
      validUntil: null,
      status: "RECEIVED",
      receivedAt: new Date(BASE_TIME + index),
      ...row,
    })),
    audits: [],
  };

  const fake = {
    externalDecisionReceipt: {
      create: async ({ data }) => {
        const row = {
          id: `er-${state.receipts.length + 1}`,
          programmeId: null,
          signature: null,
          validUntil: null,
          contentHash: null,
          status: "RECEIVED",
          receivedAt: new Date(BASE_TIME + state.receipts.length),
          ...data,
        };
        state.receipts.push(row);
        return row;
      },
      findUnique: async ({ where }) => state.receipts.find((row) => matchesWhere(row, where)) ?? null,
      findFirst: async ({ where, orderBy } = {}) =>
        sortRows(state.receipts.filter((row) => matchesWhere(row, where)), orderBy)[0] ?? null,
      findMany: async ({ where, orderBy, take } = {}) => {
        const matched = sortRows(state.receipts.filter((row) => matchesWhere(row, where)), orderBy);
        return take == null ? matched : matched.slice(0, take);
      },
    },
    coreAuditLog: { create: async ({ data }) => { state.audits.push(data); return data; } },
    $transaction: async (callback) => callback(fake),
  };
  return { fake, state };
}

function receiveInput(overrides = {}) {
  return {
    issuerKey: "FSV1",
    objectType: "paper",
    objectId: "p1",
    objectRevision: 1,
    purpose: "publication_approval",
    decision: "APPROVED",
    minimalJson: { ok: true },
    idempotencyKey: "k-1",
    ...overrides,
  };
}

test("hashReceiptContent：minimalJson 嵌套键序无关，内容变更哈希变更", () => {
  const base = {
    issuerKey: "FSV1",
    objectType: "paper",
    objectId: "p1",
    objectRevision: 2,
    purpose: "publication_approval",
    decision: "APPROVED",
    minimalJson: { score: 88, notes: { b: "x", a: [1, 2] } },
  };
  const reordered = {
    decision: "APPROVED",
    minimalJson: { notes: { a: [1, 2], b: "x" }, score: 88 },
    purpose: "publication_approval",
    objectRevision: 2,
    objectId: "p1",
    objectType: "paper",
    issuerKey: "FSV1",
  };
  const left = receipts.hashReceiptContent(base);
  assert.equal(left, receipts.hashReceiptContent(reordered));
  assert.match(left, /^[0-9a-f]{64}$/);
  assert.notEqual(
    left,
    receipts.hashReceiptContent({ ...base, minimalJson: { score: 89, notes: { b: "x", a: [1, 2] } } }),
  );
});

test("receiveDecisionReceipt：正常入库 contentHash/validUntil 落库并写审计", async () => {
  const { fake, state } = makeFake();
  const validUntil = new Date(Date.now() + 3_600_000);
  const input = receiveInput({
    programmeId: "prog-1",
    objectRevision: 2,
    signature: "sig-1",
    idempotencyKey: "k-1",
    validUntil,
  });

  const result = await receipts.receiveDecisionReceipt(fake, input);
  assert.equal(result.deduplicated, false);
  assert.equal(typeof result.receiptId, "string");

  const row = state.receipts.find((r) => r.id === result.receiptId);
  assert.equal(row.issuerKey, "FSV1");
  assert.equal(row.programmeId, "prog-1");
  assert.equal(row.objectRevision, 2);
  assert.equal(row.signature, "sig-1");
  assert.equal(row.validUntil.getTime(), validUntil.getTime());
  // contentHash 仅覆盖 7 个内容字段：idempotencyKey/signature/validUntil/programmeId 不参与
  assert.equal(row.contentHash, receipts.hashReceiptContent({
    issuerKey: input.issuerKey,
    objectType: input.objectType,
    objectId: input.objectId,
    objectRevision: input.objectRevision,
    purpose: input.purpose,
    decision: input.decision,
    minimalJson: input.minimalJson,
  }));

  assert.equal(state.audits.length, 1);
  const audit = state.audits[0];
  assert.equal(audit.action, "decision_receipt.receive");
  assert.equal(audit.result, "received");
  assert.equal(audit.actorUserId, null);
  assert.equal(audit.subjectType, "paper");
  assert.equal(audit.subjectId, "p1");
  assert.equal(audit.metadataJson.receiptId, result.receiptId);
  assert.equal(audit.metadataJson.issuerKey, "FSV1");
  assert.equal(audit.metadataJson.objectRevision, 2);
  assert.equal(audit.metadataJson.purpose, "publication_approval");
  assert.equal(audit.metadataJson.decision, "APPROVED");
});

test("校验：validUntil 过去或 objectRevision 小于 1 → 400，不入库不写审计", async () => {
  const { fake, state } = makeFake();

  const expired = await receipts.receiveDecisionReceipt(fake, receiveInput({
    idempotencyKey: "k-expired",
    validUntil: new Date(Date.now() - 60_000),
  }));
  assert.equal(expired.status, 400);
  assert.equal(expired.code, "INVALID_REQUEST");

  const badRevision = await receipts.receiveDecisionReceipt(fake, receiveInput({
    idempotencyKey: "k-rev0",
    objectRevision: 0,
  }));
  assert.equal(badRevision.status, 400);
  assert.equal(badRevision.code, "INVALID_REQUEST");

  assert.equal(state.receipts.length, 0);
  assert.equal(state.audits.length, 0);
});

test("陈旧：已有更新 revision 后提交旧 revision → 409 RECEIPT_STALE，不新增行", async () => {
  const { fake, state } = makeFake();
  const rev3 = await receipts.receiveDecisionReceipt(fake, receiveInput({ objectRevision: 3, idempotencyKey: "k-r3" }));
  assert.equal(rev3.deduplicated, false);

  const stale = await receipts.receiveDecisionReceipt(fake, receiveInput({ objectRevision: 2, idempotencyKey: "k-r2" }));
  assert.equal(stale.status, 409);
  assert.equal(stale.code, "RECEIPT_STALE");
  assert.equal(state.receipts.length, 1);
  assert.equal(state.audits.length, 1, "被拒绝的提交不应产生审计");
});

test("同键重放：同内容 deduplicated=true 不新增行；异内容 409 RECEIPT_CONFLICT", async () => {
  // contentHash 只覆盖 7 个内容字段（issuerKey/objectType/objectId/objectRevision/
  // purpose/decision/minimalJson），idempotencyKey/signature/validUntil 不参与：
  // 同键同内容重放去重返回，同键异内容冲突。
  const { fake, state } = makeFake();
  const first = await receipts.receiveDecisionReceipt(fake, receiveInput({ idempotencyKey: "k-1" }));
  assert.equal(first.deduplicated, false);
  assert.equal(state.receipts.length, 1);

  const replay = await receipts.receiveDecisionReceipt(fake, receiveInput({ idempotencyKey: "k-1" }));
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.receiptId, first.receiptId);
  assert.equal(state.receipts.length, 1);
  assert.equal(state.audits.length, 1, "去重重放不应重复写审计");

  // 佐证：库中 contentHash == 仅 7 个内容字段重建的哈希
  const row = state.receipts[0];
  assert.equal(
    row.contentHash,
    receipts.hashReceiptContent({
      issuerKey: row.issuerKey,
      objectType: row.objectType,
      objectId: row.objectId,
      objectRevision: row.objectRevision,
      purpose: row.purpose,
      decision: row.decision,
      minimalJson: row.minimalJson,
    }),
  );
});

test("同键异内容 → 409 RECEIPT_CONFLICT，不新增行", async () => {
  const { fake, state } = makeFake();
  await receipts.receiveDecisionReceipt(fake, receiveInput({ idempotencyKey: "k-1" }));

  const conflict = await receipts.receiveDecisionReceipt(fake, receiveInput({ idempotencyKey: "k-1", decision: "REVOKED" }));
  assert.equal(conflict.status, 409);
  assert.equal(conflict.code, "RECEIPT_CONFLICT");
  assert.equal(state.receipts.length, 1);
  assert.equal(state.audits.length, 1);
});

test("同 revision：异内容 409 RECEIPT_CONFLICT；同内容异键 deduplicated", async () => {
  // contentHash 不含 idempotencyKey：同一 issuer+object+purpose+revision 的
  // 同内容提交（即便换键）去重返回；异内容才是真正的冲突。
  const { fake, state } = makeFake();
  const rev3 = await receipts.receiveDecisionReceipt(fake, receiveInput({ objectRevision: 3, idempotencyKey: "k-r3" }));

  const different = await receipts.receiveDecisionReceipt(fake, receiveInput({ objectRevision: 3, decision: "REVOKED", idempotencyKey: "k-r3b" }));
  assert.equal(different.status, 409);
  assert.equal(different.code, "RECEIPT_CONFLICT");

  const sameContentNewKey = await receipts.receiveDecisionReceipt(fake, receiveInput({ objectRevision: 3, idempotencyKey: "k-r3c" }));
  assert.equal(sameContentNewKey.deduplicated, true);
  assert.equal(sameContentNewKey.receiptId, rev3.receiptId);
  assert.equal(state.receipts.length, 1, "去重不应新增行");
  assert.equal(state.receipts[0].id, rev3.receiptId);
});

test("findAuthoritativeReceipt：最新 APPROVED 返回，最新 REVOKED 覆盖旧批准 → null", async () => {
  const { fake } = makeFake();
  const first = await receipts.receiveDecisionReceipt(fake, receiveInput({ objectId: "approved-1", objectRevision: 1, idempotencyKey: "k-a1" }));
  const second = await receipts.receiveDecisionReceipt(fake, receiveInput({ objectId: "approved-1", objectRevision: 2, idempotencyKey: "k-a2" }));
  const found = await receipts.findAuthoritativeReceipt(fake, { objectType: "paper", objectId: "approved-1", purpose: "publication_approval" });
  assert.equal(found.receipt.id, second.receiptId, "取最新 revision 而非第一条");
  assert.notEqual(found.receipt.id, first.receiptId);
  assert.equal(found.receipt.decision, "APPROVED");

  await receipts.receiveDecisionReceipt(fake, receiveInput({ objectId: "revoked-1", objectRevision: 1, idempotencyKey: "k-v1" }));
  await receipts.receiveDecisionReceipt(fake, receiveInput({ objectId: "revoked-1", objectRevision: 2, decision: "REVOKED", idempotencyKey: "k-v2" }));
  const revoked = await receipts.findAuthoritativeReceipt(fake, { objectType: "paper", objectId: "revoked-1", purpose: "publication_approval" });
  assert.equal(revoked.receipt, null, "最新为 REVOKED 时旧 APPROVED 被覆盖，不视为有效决定");

  const missing = await receipts.findAuthoritativeReceipt(fake, { objectType: "paper", objectId: "missing-1", purpose: "publication_approval" });
  assert.equal(missing.receipt, null);
});

test("findAuthoritativeReceipt：validUntil 过期与 minRevision 不满足 → null", async () => {
  const { fake } = makeFake();
  const validUntil = new Date(Date.now() + 3_600_000);
  const created = await receipts.receiveDecisionReceipt(fake, receiveInput({
    objectId: "exp-1",
    objectRevision: 2,
    idempotencyKey: "k-e1",
    validUntil,
  }));

  const beforeExpiry = await receipts.findAuthoritativeReceipt(fake, { objectType: "paper", objectId: "exp-1", at: new Date(validUntil.getTime() - 60_000) });
  assert.equal(beforeExpiry.receipt.id, created.receiptId);
  const afterExpiry = await receipts.findAuthoritativeReceipt(fake, { objectType: "paper", objectId: "exp-1", at: new Date(validUntil.getTime() + 60_000) });
  assert.equal(afterExpiry.receipt, null, "validUntil 过期不视为有效决定");

  const tooLow = await receipts.findAuthoritativeReceipt(fake, {
    objectType: "paper",
    objectId: "exp-1",
    minRevision: 3,
    at: new Date(validUntil.getTime() - 60_000),
  });
  assert.equal(tooLow.receipt, null, "最新 revision 2 低于 minRevision 3");
  const met = await receipts.findAuthoritativeReceipt(fake, {
    objectType: "paper",
    objectId: "exp-1",
    minRevision: 2,
    at: new Date(validUntil.getTime() - 60_000),
  });
  assert.equal(met.receipt.id, created.receiptId);
});

test("findAuthoritativeReceipt：purpose 过滤 publication_approval 与 feedback 互不混淆", async () => {
  const { fake } = makeFake();
  await receipts.receiveDecisionReceipt(fake, receiveInput({
    objectId: "mix-1", objectRevision: 2, decision: "REVOKED", idempotencyKey: "k-m1",
  }));
  await receipts.receiveDecisionReceipt(fake, receiveInput({
    objectId: "mix-1", objectRevision: 2, purpose: "feedback", idempotencyKey: "k-m2",
  }));

  const pub = await receipts.findAuthoritativeReceipt(fake, { objectType: "paper", objectId: "mix-1", purpose: "publication_approval" });
  assert.equal(pub.receipt, null, "发布门看到 REVOKED，存在 feedback 批准也不抵发布撤销");
  const feedback = await receipts.findAuthoritativeReceipt(fake, { objectType: "paper", objectId: "mix-1", purpose: "feedback" });
  assert.equal(feedback.receipt.decision, "APPROVED");
  assert.equal(feedback.receipt.purpose, "feedback");

  const unfiltered = await receipts.findAuthoritativeReceipt(fake, { objectType: "paper", objectId: "mix-1" });
  assert.equal(unfiltered.receipt.purpose, "feedback", "不带 purpose 时取整体最新（同 revision 按 receivedAt 取后到）");
});

test("listDecisionReceipts：objectType/objectId/purpose/issuerKey 过滤", async () => {
  const t0 = BASE_TIME + 100;
  const { fake } = makeFake({
    receipts: [
      { id: "r1", issuerKey: "FSV1-A", objectType: "paper", objectId: "p1", purpose: "publication_approval", receivedAt: new Date(t0 + 1) },
      { id: "r2", issuerKey: "FSV1-A", objectType: "paper", objectId: "p1", purpose: "feedback", receivedAt: new Date(t0 + 2) },
      { id: "r3", issuerKey: "FSV1-B", objectType: "paper", objectId: "p2", purpose: "publication_approval", receivedAt: new Date(t0 + 3) },
      { id: "r4", issuerKey: "FSV1-B", objectType: "dataset", objectId: "d1", purpose: "publication_approval", receivedAt: new Date(t0 + 4) },
    ],
  });

  const all = await receipts.listDecisionReceipts(fake, {});
  assert.deepEqual(all.receipts.map((row) => row.id), ["r4", "r3", "r2", "r1"], "默认按 receivedAt 倒序");

  const byObjectType = await receipts.listDecisionReceipts(fake, { objectType: "dataset" });
  assert.deepEqual(byObjectType.receipts.map((row) => row.id), ["r4"]);

  const byObjectId = await receipts.listDecisionReceipts(fake, { objectId: "p2" });
  assert.deepEqual(byObjectId.receipts.map((row) => row.id), ["r3"]);

  const byPurpose = await receipts.listDecisionReceipts(fake, { purpose: "feedback" });
  assert.deepEqual(byPurpose.receipts.map((row) => row.id), ["r2"]);

  const byIssuer = await receipts.listDecisionReceipts(fake, { issuerKey: "FSV1-A" });
  assert.deepEqual(byIssuer.receipts.map((row) => row.id), ["r2", "r1"]);

  const combined = await receipts.listDecisionReceipts(fake, { objectType: "paper", issuerKey: "FSV1-B" });
  assert.deepEqual(combined.receipts.map((row) => row.id), ["r3"]);
});

test("listDecisionReceipts：keyset 游标翻页不漏读也不重读", async () => {
  const { fake } = makeFake({
    receipts: [
      { id: "r1", issuerKey: "FSV1", receivedAt: new Date(BASE_TIME + 1) },
      // 同一时间戳的两行：游标必须靠 id 二级排序拆开，否则翻页会漏掉其中一行。
      { id: "r2", issuerKey: "FSV1", receivedAt: new Date(BASE_TIME + 2) },
      { id: "r2b", issuerKey: "FSV1", receivedAt: new Date(BASE_TIME + 2) },
      { id: "r3", issuerKey: "FSV1", receivedAt: new Date(BASE_TIME + 3) },
      { id: "r4", issuerKey: "OTHER", receivedAt: new Date(BASE_TIME + 4) },
    ],
  });

  const first = await receipts.listDecisionReceipts(fake, { issuerKey: "FSV1", take: 2 });
  assert.deepEqual(first.receipts.map((row) => row.id), ["r3", "r2b"]);

  const second = await receipts.listDecisionReceipts(fake, {
    issuerKey: "FSV1",
    take: 2,
    cursor: { receivedAt: new Date(BASE_TIME + 2), id: "r2b" },
  });
  assert.deepEqual(second.receipts.map((row) => row.id), ["r2", "r1"], "游标停在 r2b：同时间戳但 id 更小的 r2 仍要返回");

  const tail = await receipts.listDecisionReceipts(fake, {
    issuerKey: "FSV1",
    take: 5,
    cursor: { receivedAt: new Date(BASE_TIME + 1), id: "r1" },
  });
  assert.deepEqual(tail.receipts, [], "末页之后不再有数据");
});
