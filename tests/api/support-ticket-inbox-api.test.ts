/**
 * API 集成测试：支持工单后台收件箱（2026-09-21 决策项 3）
 *
 * 覆盖（真实数据库 + 真实会话）：
 * - 角色门禁：匿名访问后台列表 401 JSON；ATTENDEE / EVENT_MANAGER 访问列表与工单更新 403 JSON
 * - ADMIN 列表：分页 + 状态/类别筛选 + 关键词检索 + 状态计数；非法 status 400
 * - 状态机：PENDING→REPLIED 必须带回复正文（否则 400）；回复过短 400；回退 PENDING 409；
 *   REPLIED→CLOSED 200；关闭后再写 409；未知工单 404
 * - 落库与回执：repliedBy/repliedAt 写入正确，回复正文出现在提交者的消息中心页面
 * - 审计：CONTACT_MESSAGE_TRIAGED 的 SUCCESS 与 REJECTED 两类均落 core_audit_logs
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { ApiClient, waitForServer } from "./_client";
import { buildLoginPayload, testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3100";
const locale = testData.locale;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const runStartedAt = new Date();
const replyText = `Support acknowledged for ticket ${suffix}.`;

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const eventManagerClient = new ApiClient(baseURL);
const senderClient = new ApiClient(baseURL);
const anonymousClient = new ApiClient(baseURL);

const state: { senderId?: string; ticketId?: string; adminId?: string } = {};
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

async function login(client: ApiClient, email: string) {
  const response = await client.login(buildLoginPayload(locale, email, "seeded-password"));
  assert.equal(response.status, 200, `登录失败 (${email}): ${JSON.stringify(response.data)}`);
}

/** 绕过 ApiClient 的重定向跟随，观察鉴权失败时的原始响应。 */
async function rawFetch(client: ApiClient, method: string, path: string, body?: Record<string, unknown>) {
  return fetch(`${baseURL}${path}`, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Cookie: client.getCookieString() },
    body: body ? JSON.stringify(body) : undefined,
  });
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

after(async () => {
  if (prisma) {
    await prisma.contactMessage.deleteMany({ where: { id: state.ticketId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: state.senderId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

describe("支持工单后台收件箱", () => {
  test("准备：提交人账号、待处理工单与各角色会话", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const sender = await client.user.create({
      data: {
        email: `ticket_sender_${suffix}@example.com`,
        password: await hash("seeded-password", 10),
        name: `Ticket Sender ${suffix}`,
        role: "ATTENDEE",
        emailVerified: new Date(),
      },
      select: { id: true, name: true, email: true },
    });
    state.senderId = sender.id;

    const ticket = await client.contactMessage.create({
      data: {
        userId: sender.id,
        name: sender.name,
        email: sender.email,
        category: "VOLUNTEER",
        subject: `Volunteer enquiry ${suffix}`,
        message: "Which sessions still need volunteers this season?",
        status: "PENDING",
      },
      select: { id: true },
    });
    state.ticketId = ticket.id;

    await login(adminClient, testData.seededUsers.admin.email);
    await login(eventManagerClient, testData.seededUsers.eventManager.email);
    await login(senderClient, sender.email);

    const admin = await client.user.findUnique({
      where: { email: testData.seededUsers.admin.email },
      select: { id: true },
    });
    state.adminId = admin?.id;
  });

  test("角色门禁：非 ADMIN 无法读取工单列表", async (t) => {
    skipUnlessReady(t);

    // 2026-09-21 决策项 1 第 1 批已落地：后台 JSON 接口改用 requireApiRole/requireApiUser，
    // 鉴权失败直接返回 401/403 JSON，不再沿用页面式 redirect() 的 307。
    const anonymous = await rawFetch(anonymousClient, "GET", "/api/admin/messages");
    assert.equal(anonymous.status, 401);
    assert.ok(anonymous.headers.get("content-type")?.includes("application/json"), "匿名鉴权失败必须返回 JSON");
    assert.equal((await anonymous.json()).error, "Authentication required.");

    const denied = await Promise.all([
      rawFetch(senderClient, "GET", "/api/admin/messages"),
      rawFetch(eventManagerClient, "GET", "/api/admin/messages"),
      rawFetch(eventManagerClient, "PATCH", `/api/admin/messages/${state.ticketId}`, { status: "CLOSED" }),
    ]);

    for (const response of denied) {
      assert.equal(response.status, 403, "非 ADMIN 必须被拒绝，且不得返回工单数据");
      assert.ok(response.headers.get("content-type")?.includes("application/json"), "鉴权失败必须返回 JSON 载荷");
      const payload = await response.json();
      assert.equal(payload.error, "Forbidden.");
      assert.equal(payload.tickets, undefined, "鉴权失败不得泄漏工单数据");
    }
  });

  test("列表：筛选、检索与状态计数", async (t) => {
    skipUnlessReady(t);

    const list = await adminClient.get<{
      tickets: { id: string; status: string; category: string }[];
      counts: Record<string, number>;
      pagination: { page: number; pageSize: number; total: number };
    }>("/api/admin/messages?status=PENDING&category=VOLUNTEER");
    assert.equal(list.status, 200, JSON.stringify(list.data));
    assert.ok(list.data.tickets.some((ticket) => ticket.id === state.ticketId));
    assert.ok(list.data.tickets.every((ticket) => ticket.status === "PENDING" && ticket.category === "VOLUNTEER"));
    assert.ok(list.data.counts.PENDING >= 1);

    const searched = await adminClient.get<{ tickets: { id: string }[] }>(
      `/api/admin/messages?search=${encodeURIComponent(suffix)}`,
    );
    assert.equal(searched.status, 200);
    assert.ok(searched.data.tickets.some((ticket) => ticket.id === state.ticketId));

    const invalid = await adminClient.get("/api/admin/messages?status=NOT_A_STATUS");
    assert.equal(invalid.status, 400, "非法状态筛选必须 400");
  });

  test("状态机：缺正文的回复被拒，带正文的回复推进到 REPLIED", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    const missingReply = await adminClient.patch(`/api/admin/messages/${state.ticketId}`, { status: "REPLIED" });
    assert.equal(missingReply.status, 400, JSON.stringify(missingReply.data));

    const tooShort = await adminClient.patch(`/api/admin/messages/${state.ticketId}`, { adminReply: "ab" });
    assert.equal(tooShort.status, 400, "过短回复必须 400");

    const replied = await adminClient.patch<{ ticket: { status: string; adminReply: string; repliedAt: string | null } }>(
      `/api/admin/messages/${state.ticketId}`,
      { adminReply: replyText, status: "REPLIED" },
    );
    assert.equal(replied.status, 200, JSON.stringify(replied.data));
    assert.equal(replied.data.ticket.status, "REPLIED");
    assert.equal(replied.data.ticket.adminReply, replyText);
    assert.ok(replied.data.ticket.repliedAt);

    const row = await client.contactMessage.findUnique({ where: { id: state.ticketId! } });
    assert.equal(row?.repliedBy, state.adminId);
    assert.equal(row?.status, "REPLIED");

    const reopened = await adminClient.patch(`/api/admin/messages/${state.ticketId}`, { status: "PENDING" });
    assert.equal(reopened.status, 409, "工单不允许回退到 PENDING");
  });

  test("回复正文对提交者可见，内部备注不可见", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    await client.contactMessage.update({ where: { id: state.ticketId! }, data: { adminNotes: `secret-note-${suffix}` } });

    const page = await fetch(`${baseURL}/en/dashboard/messages`, { headers: { Cookie: senderClient.getCookieString() } });
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.ok(html.includes(replyText), "提交者消息中心应展示回复正文");
    assert.equal(html.includes(`secret-note-${suffix}`), false, "内部备注不得出现在用户侧");
  });

  test("关闭后只读，未知工单 404", async (t) => {
    skipUnlessReady(t);

    const closed = await adminClient.patch<{ ticket: { status: string } }>(`/api/admin/messages/${state.ticketId}`, {
      status: "CLOSED",
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.data));
    assert.equal(closed.data.ticket.status, "CLOSED");

    const afterClose = await adminClient.patch(`/api/admin/messages/${state.ticketId}`, {
      adminNotes: "written after closing",
    });
    assert.equal(afterClose.status, 409, "已关闭工单必须只读");

    const missing = await adminClient.patch("/api/admin/messages/00000000-0000-0000-0000-000000000000", {
      adminNotes: "orphan",
    });
    assert.equal(missing.status, 404);
  });

  test("审计：成功与拒绝的处理动作均落库", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const audits = await client.coreAuditLog.findMany({
      where: { createdAt: { gte: runStartedAt }, subjectType: "ContactMessage" },
      select: { action: true, result: true },
    });
    assert.ok(audits.some((audit) => audit.action === "CONTACT_MESSAGE_TRIAGED" && audit.result === "SUCCESS"));
    assert.ok(audits.some((audit) => audit.action === "CONTACT_MESSAGE_TRIAGED" && audit.result === "REJECTED"));
    assert.ok(audits.some((audit) => audit.action === "CONTACT_MESSAGE_LIST_VIEWED"));
  });
});
