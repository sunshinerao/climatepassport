/**
 * API 集成测试：可靠 outbox 端到端（CP-TODO-244 / CP-FR-070）
 *
 * 覆盖（真实数据库 + 真实 HTTP 传输到进程内接收器）：
 * - 证书撤销与出站事件同事务：撤销 200 ⇒ outbound_dispatches 行已存在（PENDING），
 *   payload 不含 verification code 等敏感字段
 * - 处理：真实 POST 到登记 callbackUrl（携带幂等/版本头），行转 SUCCEEDED 并记回执
 * - 对账：回执登记幂等；旧 revision 拒绝（旧事件不能覆盖新状态）
 * - 失败队列：回调不可达 → 退避重试 → 耗尽死信；管理端重投（DEAD → PENDING）
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
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

const state: {
  issueId?: string;
  verificationCode?: string;
  liveClientId?: string;
  liveClientKey?: string;
  receiverPort?: number;
  received: Array<{ body: Record<string, unknown>; headers: Record<string, string | string[] | undefined> }>;
} = { received: [] };

let receiver: Server | null = null;

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

/**
 * 认领顺序是 `nextRetryAt asc`，而并发文件会在同一轮里往池子里堆上千条到期行。
 * 只把本行挪到「1 秒前」仍然排在它们后面，15 次循环连 5 次退避都攒不满，故置为 epoch 抢在最前。
 */
async function forceDue(dispatchId: string) {
  const client = await db();
  await client.outboundDispatch.updateMany({ where: { id: dispatchId }, data: { nextRetryAt: new Date(0) } });
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
  receiver = createServer((req: IncomingMessage, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      state.received.push({ body: JSON.parse(raw || "{}"), headers: req.headers });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ received: true }));
    });
  });
  await new Promise<void>((resolve) => receiver!.listen(0, "127.0.0.1", resolve));
  state.receiverPort = (receiver.address() as AddressInfo).port;
  receiver!.unref();
});

after(async () => {
  await new Promise<void>((resolve) => (receiver ? receiver.close(() => resolve()) : resolve()));
});

describe("可靠 outbox 端到端（CP-TODO-244）", () => {
  test("准备：登记带回调的机器客户端并签发证书", async (t) => {
    skipUnlessReady(t);
    // 清理历史运行的残留：旧出站事件删除，旧 dispatch 客户端停用（避免占满处理批次/错误扇出）。
    const prisma = await db();
    const history = await prisma.outboundDispatch.deleteMany({ where: { createdAt: { lt: runStartedAt } } });
    void history;
    await prisma.channelClient.updateMany({
      where: { isActive: true, allowedScopes: { has: "dispatch:certificates:lifecycle" }, createdAt: { lt: runStartedAt } },
      data: { isActive: false },
    });
    const seeded = testData.seededUsers;
    const login = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(login.status, 200, `管理员登录失败: ${JSON.stringify(login.data)}`);

    const client = await db();
    const tenant = await client.tenant.create({
      data: { key: `dispatch-tenant-${suffix}`, name: `Dispatch Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = await client.programme.create({
      data: { key: `dispatch-prog-${suffix}`, name: `Dispatch Programme ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });

    const register = await adminClient.post("/api/admin/channel-clients", {
      key: `DSPT${suffix.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}`.slice(0, 15),
      displayName: `Dispatch Receiver ${suffix}`,
      type: "MACHINE",
      programmeId: programme.id,
      allowedOrigins: [],
      allowedScopes: ["dispatch:certificates:lifecycle"],
      machineKey: `cpmk_dispatch_${suffix}`,
      callbackUrl: `http://127.0.0.1:${state.receiverPort}/receive`,
    });
    assert.equal(register.status, 201, `登记回调客户端失败: ${JSON.stringify(register.data)}`);
    state.liveClientId = (register.data as { client: { id: string; key: string } }).client.id;
    state.liveClientKey = (register.data as { client: { key: string } }).client.key;

    const category = await adminClient.post("/api/admin/certificates/categories", {
      key: `dispatch-cat-${suffix}`.slice(0, 60).toLowerCase(),
      name: `Dispatch Category ${suffix}`,
      nameEn: `Dispatch Category ${suffix}`,
      isActive: true,
    });
    const categoryId = ((category.data as { category?: { id: string } }).category ?? category.data as { id?: string }).id;
    const template = await adminClient.post("/api/admin/certificates/templates", {
      categoryId,
      name: `Dispatch Certificate ${suffix}`,
      nameEn: `Dispatch Certificate ${suffix}`,
      templateType: "ACHIEVEMENT",
      pageSize: "A4_LANDSCAPE",
      isActive: true,
      definitionName: `Dispatch Definition ${suffix}`,
      approvalMode: "auto",
    });
    const definitionId = (template.data as { definition?: { id: string } }).definition?.id;
    const holder = await client.user.findUniqueOrThrow({ where: { email: seeded.attendee.email }, select: { id: true } });
    const verificationCode = `CV-DSP-${suffix}`.toUpperCase();
    const issue = await client.certificateIssue.create({
      data: {
        definitionId: definitionId!,
        userId: holder.id,
        sourceType: "CERTIFICATE_ISSUED",
        status: "ISSUED",
        verificationCode,
        publicVisible: true,
        issuedAt: new Date(),
      },
      select: { id: true },
    });
    state.issueId = issue.id;
    state.verificationCode = verificationCode;
  });

  test("撤销与出站事件同事务：撤销 200 即入队，payload 无敏感字段", async (t) => {
    skipUnlessReady(t);
    const revoke = await adminClient.post(`/api/admin/certificates/${state.issueId}/revoke`, { reason: "dispatch test revocation" });
    assert.equal(revoke.status, 200, `撤销失败: ${JSON.stringify(revoke.data)}`);

    const client = await db();
    const issue = await client.certificateIssue.findUniqueOrThrow({ where: { id: state.issueId } });
    assert.equal(issue.status, "REVOKED");
    const dispatch = await client.outboundDispatch.findFirstOrThrow({
      where: { eventType: "certificate.revoked", payloadJson: { path: ["certificateIssueId"], equals: state.issueId } },
    });
    assert.equal(dispatch.status, "PENDING");
    const raw = JSON.stringify(dispatch.payloadJson);
    assert.equal(raw.includes(state.verificationCode!), false, "payload 不得包含 verification code");
    assert.equal(raw.includes(issue.userId), false, "payload 不得包含持有者账号 id");
    assert.equal((dispatch.payloadJson as { status: string }).status, "REVOKED");
    assert.ok((dispatch.payloadJson as { reason: string }).reason);
  });

  test("处理：真实 POST 到 callbackUrl，行转 SUCCEEDED 并携带幂等/版本头", async (t) => {
    skipUnlessReady(t);
    // 共享测试库可能残留旧事件：分批处理直至本用例的行投递成功（旧死信退避后不再被认领）。
    let received;
    for (let round = 0; round < 6 && !received; round += 1) {
      const process = await adminClient.post("/api/admin/dispatches/process", { limit: 50 });
      assert.equal(process.status, 200, `处理失败: ${JSON.stringify(process.data)}`);
      received = state.received.find((entry) => (entry.body as { eventType?: string }).eventType === "certificate.revoked");
      if (!received) await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.ok(received, "接收器应收到 certificate.revoked 事件");
    assert.ok(received, "接收器应收到 certificate.revoked 事件");
    assert.equal((received.body as { payload: { certificateIssueId: string } }).payload.certificateIssueId, state.issueId);
    assert.equal(typeof received.headers["x-dispatch-idempotency-key"], "string");
    assert.equal(received.headers["x-dispatch-revision"], "1");

    const client = await db();
    let dispatch;
    for (let round = 0; round < 10; round += 1) {
      dispatch = await client.outboundDispatch.findFirstOrThrow({
        where: { eventType: "certificate.revoked", payloadJson: { path: ["certificateIssueId"], equals: state.issueId } },
      });
      if (dispatch.status === "SUCCEEDED") break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(dispatch.status, "SUCCEEDED", `行状态异常: attempts=${dispatch.attempts} error=${dispatch.lastError} receipt=${JSON.stringify(dispatch.receiptJson)}`);
    const receipt = dispatch.receiptJson as { httpStatus: number };
    assert.equal(receipt.httpStatus, 200);
    assert.ok(dispatch.deliveredAt);
  });

  test("对账：回执幂等，旧 revision 拒绝", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const dispatch = await client.outboundDispatch.findFirstOrThrow({
      where: { eventType: "certificate.revoked", payloadJson: { path: ["certificateIssueId"], equals: state.issueId } },
    });

    const first = await adminClient.post(`/api/admin/dispatches/${dispatch.id}/reconcile`, { receipt: { confirmed: true }, revision: 1 });
    assert.equal(first.status, 200);
    assert.equal((first.data as { applied: boolean }).applied, true);
    const again = await adminClient.post(`/api/admin/dispatches/${dispatch.id}/reconcile`, { receipt: { confirmed: true }, revision: 1 });
    assert.equal((again.data as { applied: boolean }).applied, false, "相同回执必须幂等");

    await client.outboundDispatch.update({ where: { id: dispatch.id }, data: { revision: 2 } });
    const stale = await adminClient.post(`/api/admin/dispatches/${dispatch.id}/reconcile`, { receipt: { confirmed: true }, revision: 1 });
    assert.equal(stale.status, 409, "旧 revision 不得覆盖新状态");
  });

  test("失败队列：不可达回调退避后死信，管理端可重投", async (t) => {
    skipUnlessReady(t);

    // 登记第二个客户端：回调指向未监听端口（连接拒绝）
    const client = await db();
    const programmeId = (await client.programme.findFirstOrThrow({ where: { key: `dispatch-prog-${suffix}` } })).id;
    const deadRegister = await adminClient.post("/api/admin/channel-clients", {
      key: `DSPD${suffix.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}`.slice(0, 15),
      displayName: `Dispatch Dead ${suffix}`,
      type: "MACHINE",
      programmeId,
      allowedOrigins: [],
      allowedScopes: ["dispatch:certificates:lifecycle"],
      machineKey: `cpmk_dead_${suffix}`,
      callbackUrl: "http://127.0.0.1:9/unreachable",
    });
    assert.equal(deadRegister.status, 201, `登记死信客户端失败: ${JSON.stringify(deadRegister.data)}`);

    // 恢复再撤销，产生覆盖两个客户端的新事件
    const restore = await adminClient.post(`/api/admin/certificates/${state.issueId}/restore`, {});
    assert.equal(restore.status, 200);
    const revokeAgain = await adminClient.post(`/api/admin/certificates/${state.issueId}/revoke`, { reason: "dispatch test revocation two" });
    assert.equal(revokeAgain.status, 200);

    const dispatches = await client.outboundDispatch.findMany({
      where: { eventType: "certificate.revoked", payloadJson: { path: ["reason"], equals: "dispatch test revocation two" } },
    });
    assert.equal(dispatches.length, 2, "两个客户端各入队一条");
    const deadRow = dispatches.find((row) => row.channelClientId === (deadRegister.data as { client: { id: string } }).client.id)!;

    // 并发文件会共享分发池且进程内并发可能把行卡在 PROCESSING 租约内；
    // 仅当本行卡 PROCESSING 时重置为可认领（绝不清零 attempts，否则永不死信）。
    let after = await client.outboundDispatch.findUniqueOrThrow({ where: { id: deadRow.id } });
    for (let attempt = 0; attempt < 15 && after.status !== "DEAD"; attempt += 1) {
      await client.outboundDispatch.updateMany({
        where: { id: deadRow.id, status: "PROCESSING" },
        data: { status: "PENDING", leaseExpiresAt: null },
      });
      await forceDue(deadRow.id);
      const processed = await adminClient.post("/api/admin/dispatches/process", { limit: 50 });
      assert.equal(processed.status, 200);
      after = await client.outboundDispatch.findUniqueOrThrow({ where: { id: deadRow.id } });
    }
    assert.equal(after.status, "DEAD", `应进入死信: ${JSON.stringify({ status: after.status, attempts: after.attempts, error: after.lastError })}`);
    assert.ok(after.attempts >= 5, `死信前至少处理 5 次: ${after.attempts}`);
    assert.match(after.lastError ?? "", /Attempts exhausted/);

    const requeue = await adminClient.post(`/api/admin/dispatches/${deadRow.id}/retry`, {});
    assert.equal(requeue.status, 200, `重投失败: ${JSON.stringify(requeue.data)}`);
    const requeued = await client.outboundDispatch.findUniqueOrThrow({ where: { id: deadRow.id } });
    assert.equal(requeued.status, "PENDING");
    assert.equal(requeued.attempts, 0);
  });

  test("出站治理审计落库", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const audits = await client.coreAuditLog.findMany({
      where: {
        createdAt: { gte: runStartedAt },
        action: { in: ["channel_client.register", "outbound_dispatch.requeue", "outbound_dispatch.reconcile"] },
      },
    });
    const actions = new Set(audits.map((audit) => audit.action));
    for (const action of ["channel_client.register", "outbound_dispatch.requeue", "outbound_dispatch.reconcile"]) {
      assert.equal(actions.has(action), true, `缺少审计动作 ${action}`);
    }
  });
});
