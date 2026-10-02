/**
 * API 集成测试：外部决定回执（CP-TODO-250 / CP-FR-059）
 *
 * 覆盖矩阵（真实数据库 + 真实 API Key 鉴权）：
 * - 凭据：无 Authorization POST → 401 API_KEY_MISSING；错误机密 → 401 API_KEY_INVALID；
 *   scope 不含 channel:decisions:submit 的客户端 → 403 API_KEY_SCOPE_DENIED
 *   （allowedOrigins 为空，浏览器调用一并拒绝）
 * - 正常提交 {objectType, objectId, objectRevision, purpose, decision, minimalJson,
 *   idempotencyKey} → 201 {deduplicated:false, receiptId}
 * - 幂等：同键同内容重放 → 201 deduplicated=true（同 receiptId，不新增记录/审计）
 * - 冲突：同键异内容（decision 改 REVOKED）→ 409 RECEIPT_CONFLICT
 * - 陈旧：更新 revision（rev2）后再提交 rev1（新幂等键）→ 409 RECEIPT_STALE
 * - 查询：GET /api/v1/open/decision-receipts?objectId=... → 200 {ok, receipts, page}，
 *   objectId/purpose 过滤 + keyset 游标翻页生效；只回自己（issuerKey）提交的回执，
 *   且回对外投影（无 minimalJson/signature），programmeId 由 key 归属写入；
 *   管理端 GET /api/admin/decision-receipts（admin 会话）→ 200
 * - 审计：decision_receipt.receive 落库 core_audit_logs（含 rev2 元数据）
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

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const machineClient = new ApiClient(baseURL);

const state: {
  programmeId?: string;
  submitClientKey?: string;
  submitMachineKey?: string;
  otherClientKey?: string;
  otherMachineKey?: string;
  objectId?: string;
  receiptIdV1?: string;
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

const RECEIPT_PATH = "/api/v1/open/decision-receipts";

/** Open API 只认 bearer：`<clientKey>.<machineKey>` 是登记密钥的对外形态。 */
function bearer(clientKey: string, machineKey: string) {
  return { Authorization: `Bearer ${clientKey}.${machineKey}` };
}

function asError(data: unknown) {
  return (data as { error?: { code?: string; message?: string } }).error ?? {};
}

function receiptPage(data: unknown) {
  return data as {
    ok: boolean;
    receipts: Array<Record<string, unknown>>;
    page: { limit: number; nextCursor: string | null };
  };
}

function receiptBody(overrides: Record<string, unknown>) {
  return {
    objectType: "project",
    objectId: state.objectId,
    objectRevision: 1,
    purpose: "publication_approval",
    decision: "APPROVED",
    minimalJson: { ref: `r1-${suffix}` },
    idempotencyKey: `rcpt-${suffix}-1`,
    ...overrides,
  };
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("外部决定回执（CP-TODO-250）", () => {
  test("准备：登记两个 MACHINE 客户端（提交 scope 与对照 scope）", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    const login = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(login.status, 200, `管理员登录失败: ${JSON.stringify(login.data)}`);

    const client = await db();
    const tenant = await client.tenant.create({
      data: { key: `rcpt-tenant-${suffix}`, name: `Receipts Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = await client.programme.create({
      data: { key: `rcpt-prog-${suffix}`, name: `Receipts Programme ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });
    state.programmeId = programme.id;
    state.objectId = `proj-${suffix}`;

    const submitRegister = await adminClient.post("/api/admin/channel-clients", {
      displayName: `Receipts Submitter ${suffix}`,
      type: "MACHINE",
      programmeId: programme.id,
      allowedOrigins: [],
      allowedScopes: ["channel:decisions:submit"],
      machineKey: `cpmk_rcpt_submit_${suffix}`,
    });
    assert.equal(submitRegister.status, 201, `登记提交客户端失败: ${JSON.stringify(submitRegister.data)}`);
    const submitBody = submitRegister.data as { client: { id: string; key: string }; machineKey?: string };
    state.submitClientKey = submitBody.client.key;
    state.submitMachineKey = submitBody.machineKey;
    assert.ok(state.submitClientKey, "应返回 client.key");
    assert.equal(state.submitMachineKey, `cpmk_rcpt_submit_${suffix}`, "machineKey 应在创建响应中原样回显一次");

    const otherRegister = await adminClient.post("/api/admin/channel-clients", {
      displayName: `Receipts Other Scope ${suffix}`,
      type: "MACHINE",
      programmeId: programme.id,
      allowedOrigins: [],
      allowedScopes: ["channel:session:bridge"],
      machineKey: `cpmk_rcpt_other_${suffix}`,
    });
    assert.equal(otherRegister.status, 201, `登记对照客户端失败: ${JSON.stringify(otherRegister.data)}`);
    const otherBody = otherRegister.data as { client: { id: string; key: string }; machineKey?: string };
    state.otherClientKey = otherBody.client.key;
    state.otherMachineKey = otherBody.machineKey;
  });

  test("提交鉴权矩阵：无凭据 401，错误 machineKey 401，scope 不足 403", async (t) => {
    skipUnlessReady(t);

    const anonymous = await machineClient.post(RECEIPT_PATH, receiptBody({}));
    assert.equal(anonymous.status, 401, "无凭据提交必须 401");
    assert.equal(asError(anonymous.data).code, "API_KEY_MISSING");

    const wrongKey = await machineClient.post(
      RECEIPT_PATH,
      receiptBody({}),
      bearer(state.submitClientKey!, "definitely-wrong-key"),
    );
    assert.equal(wrongKey.status, 401, "错误机密必须 401");
    assert.equal(asError(wrongKey.data).code, "API_KEY_INVALID");

    const scopeDenied = await machineClient.post(
      RECEIPT_PATH,
      receiptBody({}),
      bearer(state.otherClientKey!, state.otherMachineKey!),
    );
    assert.equal(scopeDenied.status, 403, "scope 不含 channel:decisions:submit 必须 403");
    assert.equal(asError(scopeDenied.data).code, "API_KEY_SCOPE_DENIED");
  });

  test("正常提交 201 deduplicated=false；同键同内容重放 201 deduplicated=true", async (t) => {
    skipUnlessReady(t);
    const headers = bearer(state.submitClientKey!, state.submitMachineKey!);

    const first = await machineClient.post(RECEIPT_PATH, receiptBody({}), headers);
    assert.equal(first.status, 201, `首次提交失败: ${JSON.stringify(first.data)}`);
    const firstBody = first.data as { receiptId: string; deduplicated: boolean };
    assert.equal(firstBody.deduplicated, false);
    assert.ok(firstBody.receiptId, "应返回 receiptId");
    state.receiptIdV1 = firstBody.receiptId;

    const replay = await machineClient.post(RECEIPT_PATH, receiptBody({}), headers);
    assert.equal(replay.status, 201, `同键同内容重放必须幂等: ${JSON.stringify(replay.data)}`);
    assert.equal((replay.data as { deduplicated: boolean }).deduplicated, true, "同键同内容必须判重");
    assert.equal((replay.data as { receiptId: string }).receiptId, state.receiptIdV1, "重放应返回同一 receiptId");

    const client = await db();
    const rows = await client.externalDecisionReceipt.findMany({ where: { objectId: state.objectId } });
    assert.equal(rows.length, 1, "重放不得新增回执记录");
  });

  test("同键异内容 409 RECEIPT_CONFLICT；更新 revision 后旧 revision 409 RECEIPT_STALE", async (t) => {
    skipUnlessReady(t);
    const headers = bearer(state.submitClientKey!, state.submitMachineKey!);

    const conflict = await machineClient.post(
      RECEIPT_PATH,
      receiptBody({ decision: "REVOKED" }),
      headers,
    );
    assert.equal(conflict.status, 409, "同键异内容必须 409");
    assert.equal(asError(conflict.data).code, "RECEIPT_CONFLICT");

    const rev2 = await machineClient.post(
      RECEIPT_PATH,
      receiptBody({
        objectRevision: 2,
        minimalJson: { ref: `r2-${suffix}` },
        idempotencyKey: `rcpt-${suffix}-2`,
      }),
      headers,
    );
    assert.equal(rev2.status, 201, `提交 rev2 失败: ${JSON.stringify(rev2.data)}`);
    assert.equal((rev2.data as { deduplicated: boolean }).deduplicated, false);

    const stale = await machineClient.post(
      RECEIPT_PATH,
      receiptBody({
        minimalJson: { ref: `r1b-${suffix}` },
        idempotencyKey: `rcpt-${suffix}-3`,
      }),
      headers,
    );
    assert.equal(stale.status, 409, "旧 revision 不得覆盖新决定");
    assert.equal(asError(stale.data).code, "RECEIPT_STALE");
  });

  test("查询：对外投影、过滤与游标翻页，管理端 200", async (t) => {
    skipUnlessReady(t);
    const headers = bearer(state.submitClientKey!, state.submitMachineKey!);

    const byObject = await machineClient.get(
      `${RECEIPT_PATH}?objectId=${encodeURIComponent(state.objectId!)}`,
      headers,
    );
    assert.equal(byObject.status, 200, `机器端查询失败: ${JSON.stringify(byObject.data)}`);
    const listed = receiptPage(byObject.data);
    assert.equal(listed.ok, true);
    const receipts = listed.receipts;
    assert.ok(receipts.length >= 2, "应至少返回 rev1/rev2 两条回执");
    for (const receipt of receipts) {
      assert.equal(receipt.issuerKey, state.submitClientKey, "只回这把 key 自己提交的回执");
      assert.equal(receipt.programmeId, state.programmeId, "programmeId 由 key 归属写入");
      assert.equal(receipt.minimalJson, undefined, "对外不回 minimalJson");
      assert.equal(receipt.signature, undefined, "对外不回 signature");
    }
    for (const receipt of receipts) {
      assert.equal(receipt.objectId, state.objectId, "objectId 过滤必须生效");
    }
    const revisions = receipts.map((receipt) => receipt.objectRevision).sort();
    assert.deepEqual(revisions, [1, 2], "应恰好返回本用例 rev1/rev2 两条（无跨测试串扰）");

    const byPurposeOther = await machineClient.get(
      `${RECEIPT_PATH}?objectId=${encodeURIComponent(state.objectId!)}&purpose=feedback_review`,
      headers,
    );
    assert.equal(byPurposeOther.status, 200);
    assert.equal(receiptPage(byPurposeOther.data).receipts.length, 0, "purpose 过滤必须生效");

    const byUnknownObject = await machineClient.get(
      `${RECEIPT_PATH}?objectId=proj-absent-${suffix}`,
      headers,
    );
    assert.equal(byUnknownObject.status, 200);
    assert.equal(receiptPage(byUnknownObject.data).receipts.length, 0);
    assert.equal(receiptPage(byUnknownObject.data).page.nextCursor, null, "空页没有下一页");

    // 游标翻页：limit=1 逐页取，既不重读也不漏读。
    const page1 = receiptPage((await machineClient.get(`${RECEIPT_PATH}?objectId=${encodeURIComponent(state.objectId!)}&limit=1`, headers)).data);
    assert.equal(page1.receipts.length, 1);
    assert.equal(page1.page.limit, 1);
    assert.ok(page1.page.nextCursor, "还有下一页时必须给游标");
    const page2 = receiptPage((await machineClient.get(`${RECEIPT_PATH}?objectId=${encodeURIComponent(state.objectId!)}&limit=1&cursor=${page1.page.nextCursor}`, headers)).data);
    assert.equal(page2.receipts.length, 1);
    assert.notEqual(page2.receipts[0].id, page1.receipts[0].id, "翻页不得重复同一条");
    assert.equal([page1.receipts[0], page2.receipts[0]].map((row) => row.objectRevision).sort().join(","), "1,2");

    const badCursor = await machineClient.get(`${RECEIPT_PATH}?cursor=not-a-cursor`, headers);
    assert.equal(badCursor.status, 400, `非法游标必须 400: ${JSON.stringify(badCursor.data)}`);
    assert.equal(asError(badCursor.data).code, "INVALID_REQUEST");

    const badLimit = await machineClient.get(`${RECEIPT_PATH}?limit=0`, headers);
    assert.equal(badLimit.status, 400);
    assert.equal(asError(badLimit.data).code, "INVALID_REQUEST");

    const adminList = await adminClient.get(
      `/api/admin/decision-receipts?objectId=${encodeURIComponent(state.objectId!)}`,
    );
    assert.equal(adminList.status, 200, `管理端查询失败: ${JSON.stringify(adminList.data)}`);
    const adminReceipts = (adminList.data as { receipts: Array<Record<string, unknown>> }).receipts;
    assert.ok(
      adminReceipts.some((receipt) => receipt.minimalJson !== undefined),
      "管理端仍看得到完整回执内容（对外投影不影响内部排障）",
    );
    assert.ok(adminReceipts.length >= 2, "管理端应能看到该对象的回执");
    assert.ok(
      adminReceipts.every((receipt) => receipt.objectId === state.objectId),
      "管理端 objectId 过滤必须生效",
    );
  });

  test("审计：decision_receipt.receive 落库", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const audits = await client.coreAuditLog.findMany({
      where: {
        createdAt: { gte: runStartedAt },
        action: "decision_receipt.receive",
        subjectId: state.objectId,
      },
    });
    assert.equal(audits.length, 2, `恰好两次成功接收（rev1/rev2）应各落一条审计: ${JSON.stringify(audits)}`);
    const revisions = audits.map((audit) => (audit.metadataJson as { objectRevision?: number }).objectRevision);
    assert.deepEqual(revisions.sort(), [1, 2], "审计应记录各次接收的 objectRevision");
    for (const audit of audits) {
      assert.equal((audit.metadataJson as { issuerKey?: string }).issuerKey, state.submitClientKey);
      assert.equal((audit.metadataJson as { decision?: string }).decision, "APPROVED");
    }
  });
});
