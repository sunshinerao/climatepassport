/**
 * 源码级测试：支持工单后台收件箱的查询构造与状态流转（CP-AUD 决策项 3）
 *
 * 覆盖：
 * - buildTicketWhere：空条件不得生成 OR 数组（Prisma 中 OR: [] 匹配不到任何行）
 * - resolveTicketUpdate：PENDING→REPLIED 必须带回复；CLOSED 只读；禁止回退 PENDING；
 *   仅备注不置 repliedAt；重复提交同一状态视为无变化
 * - serializeSupportTicket：日期转 ISO 字符串
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./_service-loader.mjs";

// The service sandbox runs in its own vm context, so object literals it returns have
// cross-realm prototypes; compare with JSON round-trips instead of deepStrictEqual.
const plain = (value) => JSON.parse(JSON.stringify(value));

const tickets = loadService("apps/passport-web/lib/server/support-tickets.ts");
const now = new Date("2026-09-21T08:00:00.000Z");

function update(input) {
  return tickets.resolveTicketUpdate({ actorUserId: "admin-1", ...input }, now);
}

test("buildTicketWhere omits the OR clause entirely when there is no keyword", () => {
  assert.deepEqual(plain(tickets.buildTicketWhere({})), {});
  assert.deepEqual(plain(tickets.buildTicketWhere({ search: "   " })), {});

  const filtered = tickets.buildTicketWhere({ status: "PENDING", category: "MEDIA" });
  assert.deepEqual(Object.keys(filtered).sort(), ["category", "status"]);

  const searched = tickets.buildTicketWhere({ search: "  passport  " });
  assert.equal(searched.OR.length, 4);
  assert.deepEqual(plain(searched.OR.map((clause) => Object.keys(clause)[0]).sort()), ["email", "message", "name", "subject"]);
  assert.ok(
    searched.OR.every((clause) => {
      const filter = Object.values(clause)[0];
      return filter.contains === "passport" && filter.mode === "insensitive";
    }),
  );
});

test("replying to a pending ticket moves it to replied and stamps the actor", () => {
  const result = update({ currentStatus: "PENDING", existingReply: null, status: "REPLIED", adminReply: " 已收到，我们会尽快处理。 " });

  assert.equal(result.ok, true);
  assert.equal(result.from, "PENDING");
  assert.equal(result.to, "REPLIED");
  assert.equal(result.data.status, "REPLIED");
  assert.equal(result.data.adminReply, "已收到，我们会尽快处理。");
  assert.equal(result.data.repliedBy, "admin-1");
  assert.equal(result.data.repliedAt.getTime(), now.getTime());
});

test("marking a ticket replied without any stored reply is rejected", () => {
  const result = update({ currentStatus: "PENDING", existingReply: "   ", status: "REPLIED" });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("closed tickets are read-only and tickets never move back to pending", () => {
  assert.equal(update({ currentStatus: "CLOSED", existingReply: "done", adminNotes: "x" }).ok, false);
  assert.equal(update({ currentStatus: "CLOSED", existingReply: "done", adminNotes: "x" }).status, 409);

  const reopened = update({ currentStatus: "REPLIED", existingReply: "done", status: "PENDING" });
  assert.equal(reopened.ok, false);
  assert.equal(reopened.status, 409);
});

test("closing a replied ticket keeps the reply untouched", () => {
  const result = update({ currentStatus: "REPLIED", existingReply: "already answered", status: "CLOSED" });

  assert.equal(result.ok, true);
  assert.deepEqual(plain(result.data), { status: "CLOSED" });
});

test("internal notes save without touching reply bookkeeping", () => {
  const result = update({ currentStatus: "PENDING", existingReply: null, adminNotes:  "escalated to ops  " });

  assert.equal(result.ok, true);
  assert.deepEqual(plain(result.data), { adminNotes: "escalated to ops" });
});

test("no-op patches and out-of-range replies are rejected", () => {
  assert.equal(update({ currentStatus: "REPLIED", existingReply: "x", status: "REPLIED" }).data, undefined);
  assert.equal(update({ currentStatus: "REPLIED", existingReply: "x", status: "REPLIED" }).error, "Nothing to update.");

  assert.equal(update({ currentStatus: "PENDING", existingReply: null, adminReply: "ab" }).status, 400);
  assert.equal(update({ currentStatus: "PENDING", existingReply: null, adminReply: "y".repeat(4001) }).status, 400);
  assert.equal(update({ currentStatus: "PENDING", existingReply: null, status: "SOMETHING" }).error, "Invalid status.");
  assert.equal(update({ currentStatus: "PENDING", existingReply: null }).error, "Nothing to update.");
});

test("serializeSupportTicket renders dates as ISO strings", () => {
  const serialized = tickets.serializeSupportTicket({
    id: "t1",
    name: "Sun",
    email: "sun@example.org",
    phone: null,
    organization: null,
    userId: "u1",
    category: "GENERAL",
    subject: "Passport",
    message: "hello",
    status: "PENDING",
    adminReply: null,
    adminNotes: null,
    repliedAt: null,
    repliedBy: null,
    createdAt: now,
    updatedAt: now,
  });

  assert.equal(serialized.createdAt, "2026-09-21T08:00:00.000Z");
  assert.equal(serialized.repliedAt, null);
  assert.equal(serialized.adminReply, null);
  assert.equal("metadata" in serialized, false);
});
