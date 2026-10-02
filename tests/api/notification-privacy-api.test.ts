/**
 * API 集成测试：通知投递重试/偏好、隐私安全报告、导出/删除与标记回放（CP-TODO-257 / CP-FR-066/067/068）
 *
 * 覆盖矩阵（真实数据库 + 真实会话/邮件 outbox）：
 * - 投递：ADMIN 批处理 IN_APP → DELIVERED + SUCCESS attempt（attempts 端点 200）；
 *   EMAIL 投递写 test-outbox 且只含标题+链接不含私密正文；偏好关闭 EMAIL
 *   （PATCH /api/dashboard/notifications/preferences）→ SKIPPED + deadLettered；
 *   未知通知 attempts 404；匿名 process 401 JSON
 * - 报告：匿名 401；非组织者 EM 403；ADMIN 200 且小样本单元格被抑制（null +
 *   suppressedCells），distinctPersons 为申请+参与并集
 * - 导出：匿名 401；本人导出含本人记录正文、他人授予仅索引、
 *   otherAuthorsContentIncluded=false
 * - 删除：缺 confirm → 400 PRIVACY_DELETE_CONFIRMATION_REQUIRED；确认后 200
 *   （匿名化 User、会话吊销、本人 ACTIVE 记录撤回 + 标记、审计落库、受限保留说明）；
 *   删除后该账号无法再登录
 * - 回放：ADMIN 重放隐私标记（已应用 → skipped），审计落库
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { ApiClient, waitForServer } from "./_client";
import { buildLoginPayload, testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3100";
const locale = testData.locale;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const selfClient = new ApiClient(baseURL);
const managerClient = new ApiClient(baseURL);
const anonymousClient = new ApiClient(baseURL);

const state: {
  selfUserId?: string;
  adminUserId?: string;
  activityId?: string;
  inAppNotificationId?: string;
  emailNotificationId?: string;
  optedOutNotificationId?: string;
  recordId?: string;
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

function outboxPath() {
  const configured = process.env.MAIL_TEST_OUTBOX_PATH;
  assert.ok(configured, "MAIL_TEST_OUTBOX_PATH must be configured for the isolated test env");
  return path.resolve(configured);
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("通知投递、隐私报告与生命周期（CP-TODO-257）", () => {
  test("准备：账号、活动、通知与授权数据", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    const login = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(login.status, 200, `管理员登录失败: ${JSON.stringify(login.data)}`);

    const client = await db();
    const adminUser = await client.user.findUniqueOrThrow({ where: { email: seeded.admin.email }, select: { id: true } });
    state.adminUserId = adminUser.id;

    const selfEmail = `priv_self_${suffix}@example.com`;
    const selfUser = await client.user.create({
      data: { email: selfEmail, name: "Privacy Self", password: await hash("seeded-password", 10), role: "ATTENDEE", emailVerified: new Date() },
      select: { id: true },
    });
    state.selfUserId = selfUser.id;
    const selfLogin = await selfClient.login(buildLoginPayload(locale, selfEmail, "seeded-password"));
    assert.equal(selfLogin.status, 200);

    const managerEmail = `priv_manager_${suffix}@example.com`;
    await client.user.create({
      data: { email: managerEmail, name: "Privacy Manager", password: await hash("seeded-password", 10), role: "EVENT_MANAGER", emailVerified: new Date() },
      select: { id: true },
    });
    const managerLogin = await managerClient.login(buildLoginPayload(locale, managerEmail, "seeded-password"));
    assert.equal(managerLogin.status, 200);

    const activity = await client.activity.create({
      data: {
        type: "EVENT",
        title: `Privacy Activity ${suffix}`,
        titleEn: `Privacy Activity ${suffix}`,
        slug: `priv-activity-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60),
        status: "PUBLISHED",
        language: "en",
        createdByUserId: adminUser.id,
        organizerUserId: adminUser.id,
        startTime: new Date("2026-12-05T09:00:00.000Z"),
        endTime: new Date("2026-12-05T12:00:00.000Z"),
      },
      select: { id: true },
    });
    state.activityId = activity.id;

    // 小样本报告数据：1 条 SUBMITTED 申请 + 1 条 ACCEPTED 参与
    await client.activityApplication.create({
      data: { activityId: activity.id, userId: selfUser.id, status: "SUBMITTED", submittedAt: new Date() },
    });
    await client.activityParticipation.create({
      data: { activityId: activity.id, userId: selfUser.id, status: "ACCEPTED" },
    });

    // 测试库卫生：历史 QUEUED 通知会让共享批处理池深不见底；先全部终结。
    await client.notification.updateMany({ where: { status: "QUEUED" }, data: { status: "DELIVERED", deliveredAt: new Date() } });

    const inApp = await client.notification.create({
      data: {
        userId: selfUser.id,
        channel: "IN_APP",
        kind: "SYSTEM",
        title: "站内通知标题",
        titleEn: "In-app title",
        body: "私密正文 in-app body",
      },
      select: { id: true },
    });
    state.inAppNotificationId = inApp.id;

    const email = await client.notification.create({
      data: {
        userId: selfUser.id,
        channel: "EMAIL",
        kind: "CERTIFICATE",
        title: "邮件标题 certificate ready",
        titleEn: "Certificate ready",
        body: "私密正文 never leave platform",
        actionUrl: "/en/certificates",
      },
      select: { id: true },
    });
    state.emailNotificationId = email.id;

  });

  test("投递：IN_APP 成功 + EMAIL 只发标题链接；偏好关闭后 SKIPPED 死信", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    // 后台写路由已改用 requireApiRole：匿名访问返回 401 JSON，不再重定向到登录页。
    const anonymousResponse = await fetch(`${baseURL}/api/admin/notifications/process`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(anonymousResponse.status, 401, `匿名访问必须 401: ${anonymousResponse.status}`);
    assert.ok(anonymousResponse.headers.get("content-type")?.includes("application/json"), "匿名鉴权失败必须返回 JSON");
    assert.equal((await anonymousResponse.json()).error, "Authentication required.");

    const sweepOthers = async (keepIds: string[]) => {
      await client.notification.updateMany({
        where: { status: "QUEUED", id: { notIn: keepIds } },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
    };

    // 阶段一：EMAIL 开启时投递 IN_APP + EMAIL（保留偏好默认开启）。
    const before = fs.existsSync(outboxPath()) ? fs.readFileSync(outboxPath(), "utf8") : "";
    for (let round = 0; round < 5; round += 1) {
      await sweepOthers([state.inAppNotificationId!, state.emailNotificationId!]);
      const process = await adminClient.post("/api/admin/notifications/process", { limit: 50 });
      assert.equal(process.status, 200, `批处理失败: ${JSON.stringify(process.data)}`);
      const inAppRow = await client.notification.findUniqueOrThrow({ where: { id: state.inAppNotificationId } });
      const emailRow = await client.notification.findUniqueOrThrow({ where: { id: state.emailNotificationId } });
      if (inAppRow.status === "DELIVERED" && emailRow.status === "DELIVERED") break;
    }
    const inAppRow = await client.notification.findUniqueOrThrow({ where: { id: state.inAppNotificationId } });
    assert.equal(inAppRow.status, "DELIVERED");
    const emailRow = await client.notification.findUniqueOrThrow({ where: { id: state.emailNotificationId } });
    assert.equal(emailRow.status, "DELIVERED");

    const attempts = await adminClient.get(`/api/admin/notifications/${state.inAppNotificationId}/attempts`);
    assert.equal(attempts.status, 200);
    const attemptRows = (attempts.data as { attempts: Array<{ result: string; channel: string }> }).attempts;
    assert.equal(attemptRows.length, 1);
    assert.equal(attemptRows[0].result, "SUCCESS");
    assert.equal(attemptRows[0].channel, "IN_APP");

    const missing = await adminClient.get("/api/admin/notifications/00000000-0000-0000-0000-000000000000/attempts");
    assert.equal(missing.status, 404);

    // 邮件 outbox：只含标题与链接，不含私密正文
    const after = fs.readFileSync(outboxPath(), "utf8");
    const fresh = after.slice(before.length).trim().split("\n").filter(Boolean);
    const certMail = fresh.map((line) => JSON.parse(line)).find((mail) => mail.subject === "Certificate ready");
    assert.ok(certMail, "证书邮件已写入 outbox");
    assert.equal(certMail.to, `priv_self_${suffix}@example.com`);
    assert.match(certMail.text, /Certificate ready/);
    assert.match(certMail.text, /\/en\/certificates/);
    assert.doesNotMatch(certMail.text, /never leave platform/, "私密正文不得进入邮件");

    // 阶段二：关闭 EMAIL 偏好后，新邮件 SKIPPED + 死信，且不发送。
    const preference = await selfClient.patch("/api/dashboard/notifications/preferences", {
      emailEnabled: false,
      inAppEnabled: true,
      smsEnabled: false,
      marketingEnabled: false,
    });
    assert.equal(preference.status, 200, `偏好更新失败: ${JSON.stringify(preference.data)}`);

    const optedOut = await client.notification.create({
      data: {
        userId: state.selfUserId!,
        channel: "EMAIL",
        kind: "SYSTEM",
        title: "Opted out email",
        titleEn: "Opted out email",
        body: "must not be sent",
        actionUrl: "/en/dashboard",
      },
      select: { id: true },
    });
    state.optedOutNotificationId = optedOut.id;

    const outboxBeforeSkip = fs.readFileSync(outboxPath(), "utf8");
    let optedOutRow = await client.notification.findUniqueOrThrow({ where: { id: optedOut.id } });
    for (let round = 0; round < 5 && !optedOutRow.deadLetteredAt; round += 1) {
      await sweepOthers([optedOut.id]);
      const process = await adminClient.post("/api/admin/notifications/process", { limit: 50 });
      assert.equal(process.status, 200);
      optedOutRow = await client.notification.findUniqueOrThrow({ where: { id: optedOut.id } });
    }
    assert.ok(optedOutRow.deadLetteredAt, "跳过即死信");
    assert.equal(optedOutRow.status, "QUEUED");
    const outboxAfterSkip = fs.readFileSync(outboxPath(), "utf8");
    const skippedMail = outboxAfterSkip
      .slice(outboxBeforeSkip.length)
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .find((mail) => mail.subject === "Opted out email");
    assert.equal(skippedMail, undefined, "偏好关闭的邮件不发送");
  });

  test("隐私报告：匿名 401、非管理者 403、小样本抑制与主体去重", async (t) => {
    skipUnlessReady(t);

    const anonymous = await anonymousClient.get(`/api/reports/activity-privacy?activityId=${state.activityId}`);
    assert.equal(anonymous.status, 401);

    const notManager = await managerClient.get(`/api/reports/activity-privacy?activityId=${state.activityId}`);
    assert.equal(notManager.status, 403, "非组织者 EVENT_MANAGER 不得读取报告");

    const report = await adminClient.get(`/api/reports/activity-privacy?activityId=${state.activityId}`);
    assert.equal(report.status, 200, `报告失败: ${JSON.stringify(report.data)}`);
    const body = report.data as {
      threshold: number;
      applicationsByStatus: Record<string, number | null>;
      participationsByStatus: Record<string, number | null>;
      distinctPersons: number | null;
      checkinCount: number | null;
      suppressedCells: string[];
    };
    assert.equal(body.threshold, 5);
    assert.equal(body.applicationsByStatus.SUBMITTED, null, "1 < 5 → 抑制");
    assert.equal(body.participationsByStatus.ACCEPTED, null);
    assert.equal(body.distinctPersons, null, "1 < 5 → 抑制");
    assert.equal(body.checkinCount, 0);
    assert.ok(body.suppressedCells.includes("applications.SUBMITTED"));
    assert.ok(body.suppressedCells.includes("distinctPersons"));

    const badRequest = await adminClient.get("/api/reports/activity-privacy?activityId=not-a-uuid");
    assert.equal(badRequest.status, 400);
  });

  test("导出：仅本人材料与索引，匿名 401", async (t) => {
    skipUnlessReady(t);

    const record = await selfClient.post("/api/records", {
      recordType: "lab_note",
      title: `Self export record ${suffix}`,
      payloadJson: { note: "own payload" },
    });
    assert.equal(record.status, 201, `创建记录失败: ${JSON.stringify(record.data)}`);
    state.recordId = (record.data as { recordId: string }).recordId;

    const anonymousExport = await anonymousClient.get("/api/account/export");
    assert.equal(anonymousExport.status, 401);

    const exported = await selfClient.get("/api/account/export");
    assert.equal(exported.status, 200, `导出失败: ${JSON.stringify(exported.data)}`);
    const body = exported.data as {
      profile: { email: string };
      records: Array<{ recordId: string; payloadJson: { note: string } }>;
      grantedRecordIndex: unknown[];
      otherAuthorsContentIncluded: boolean;
    };
    assert.equal(body.profile.email, `priv_self_${suffix}@example.com`);
    const own = body.records.find((row) => row.recordId === state.recordId);
    assert.ok(own, "导出含本人记录");
    assert.deepEqual(own.payloadJson, { note: "own payload" }, "本人记录带正文");
    assert.equal(body.otherAuthorsContentIncluded, false);
  });

  test("删除：确认门、匿名化、会话吊销、记录撤回与标记、无法再登录", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    const noConfirm = await selfClient.post("/api/account/delete", { reason: "leaving" });
    assert.equal(noConfirm.status, 400);
    assert.equal((noConfirm.data as { code?: string }).code, "PRIVACY_DELETE_CONFIRMATION_REQUIRED");

    const deleted = await selfClient.post("/api/account/delete", { reason: "leaving the platform", confirm: true });
    assert.equal(deleted.status, 200, `删除失败: ${JSON.stringify(deleted.data)}`);
    const body = deleted.data as { withdrawnRecords: number; retentionNotice: string[] };
    assert.ok(body.withdrawnRecords >= 1, "本人 ACTIVE 记录被撤回");
    assert.ok(body.retentionNotice.length >= 3, "受限保留说明");

    const user = await client.user.findUniqueOrThrow({ where: { id: state.selfUserId } });
    assert.equal(user.name, "Deleted user");
    assert.match(user.email, /^deleted-[a-f0-9]{24}@anonymized\.invalid$/);
    assert.equal(user.status, "SUSPENDED");
    assert.ok(user.anonymizedAt);

    const sessions = await client.session.count({ where: { userId: state.selfUserId } });
    assert.equal(sessions, 0, "会话吊销");

    const record = await client.scopedRecord.findUniqueOrThrow({ where: { id: state.recordId } });
    assert.equal(record.status, "WITHDRAWN");

    const markers = await client.privacyMarker.findMany({ where: { subjectId: state.selfUserId } });
    assert.equal(markers.length, 1);
    assert.equal(markers[0].action, "DELETED");
    const recordMarkers = await client.privacyMarker.count({ where: { subjectType: "ScopedRecord", subjectId: state.recordId } });
    assert.equal(recordMarkers, 1);

    const audit = await client.coreAuditLog.findFirst({ where: { action: "account.delete", subjectId: state.selfUserId } });
    assert.ok(audit, "删除审计落库");

    const relogin = await selfClient.login(buildLoginPayload(locale, `priv_self_${suffix}@example.com`, "seeded-password"));
    assert.notEqual(relogin.status, 200, "删除后无法再登录");
  });

  test("回放：ADMIN 重放隐私标记（幂等 skip）并落审计", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    const anonymousResponse = await fetch(`${baseURL}/api/admin/privacy/replay-markers`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(anonymousResponse.status, 401, `匿名访问必须 401: ${anonymousResponse.status}`);
    assert.ok(anonymousResponse.headers.get("content-type")?.includes("application/json"), "匿名鉴权失败必须返回 JSON");
    assert.equal((await anonymousResponse.json()).error, "Authentication required.");

    const replay = await adminClient.post("/api/admin/privacy/replay-markers", {});
    assert.equal(replay.status, 200, `回放失败: ${JSON.stringify(replay.data)}`);
    const body = replay.data as { replayed: number; applied: number; skipped: number };
    assert.ok(body.replayed >= 2, "重放覆盖删除 + 撤回标记");
    assert.equal(body.applied, 0, "标记当前已生效 → 全部 skip（幂等）");
    assert.ok(body.skipped >= 2);

    const audit = await client.coreAuditLog.findFirst({ where: { action: "PRIVACY_MARKERS_REPLAYED" } });
    assert.ok(audit, "回放审计落库");
  });
});
