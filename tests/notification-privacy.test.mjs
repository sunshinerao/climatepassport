/**
 * 源码级测试：通知投递重试/偏好、隐私安全聚合报告、本人导出/删除与隐私标记回放（CP-TODO-257 / CP-FR-066/067/068）
 *
 * 覆盖（loadService 沙箱 + 内存 Prisma mock）：
 * - isChannelOptedOut：默认 EMAIL/IN_APP 开启、SMS 关闭；显式开关生效；marketing 门
 * - deliverNotification：IN_APP 成功落 SUCCESS attempt + DELIVERED；渠道被偏好关闭
 *   → SKIPPED + deadLettered（不无限重试）；EMAIL 发送失败（沙箱内 mailer 不可加载）
 *   → FAILED attempt + nextRetryAt 指数退避；attempts 达上限 → DEAD；死信幂等；
 *   未知通知 404；邮件文本只含标题与链接（源码断言私密正文不外发）
 * - processDueNotifications：未到 nextRetryAt 的不处理；到期批处理统计正确
 * - activityPrivacyReport：小样本抑制（0 < n < 阈值 → null + suppressedCells）；
 *   distinctPersons 为申请+参与并集去重；阈值可注入
 * - exportUserData：本人记录带正文、他人授予只出索引、不含其他作者内容声明
 * - deleteUserAccount：匿名化 User/Person、会话吊销、ACTIVE 记录撤回 + 标记、
 *   审计落库、受限保留说明、幂等
 * - replayPrivacyMarkers：恢复后重放（重匿名化 + 重新撤回）、幂等 skip
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadService } from "./_service-loader.mjs";

const delivery = loadService("apps/passport-web/lib/server/notification-delivery.ts", { process: { env: {} } });
const reports = loadService("apps/passport-web/lib/server/privacy-reports.ts");
const lifecycle = loadService("apps/passport-web/lib/server/privacy-lifecycle.ts");

function matches(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return condition.every((sub) => matches(row, sub));
    if (key === "OR") return condition.some((sub) => matches(row, sub));
    if (condition !== null && typeof condition === "object") {
      if ("in" in condition) return condition.in.includes(row[key]);
      if ("lte" in condition) return row[key] != null && row[key] <= condition.lte;
      if ("lt" in condition) return row[key] != null && row[key] < condition.lt;
      if ("gte" in condition) return row[key] != null && row[key] >= condition.gte;
      if ("gt" in condition) return row[key] != null && row[key] > condition.gt;
      if ("not" in condition) return row[key] !== condition.not;
      if ("notIn" in condition) return !condition.notIn.includes(row[key]);
      if (row[key] === undefined) return matches(row, condition);
      return matches(row[key] ?? {}, condition);
    }
    return row[key] === condition;
  });
}

function table(initial = []) {
  const rows = [...initial];
  return {
    rows,
    findUnique: async ({ where }) => rows.find((row) => matches(row, where)) ?? null,
    findFirst: async ({ where } = {}) => rows.find((row) => matches(row, where)) ?? null,
    findMany: async ({ where, orderBy, take } = {}) => {
      let found = rows.filter((row) => matches(row, where));
      if (orderBy?.createdAt === "asc") found = [...found].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (orderBy?.attempt === "asc") found = [...found].sort((a, b) => a.attempt - b.attempt);
      if (typeof take === "number") found = found.slice(0, take);
      return found;
    },
    create: async ({ data }) => {
      const row = { id: `row-${rows.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const targets = rows.filter((row) => matches(row, where));
      for (const row of targets) Object.assign(row, data);
      return { count: targets.length };
    },
    deleteMany: async ({ where } = {}) => {
      const keep = rows.filter((row) => !matches(row, where));
      const removed = rows.length - keep.length;
      rows.length = 0;
      rows.push(...keep);
      return { count: removed };
    },
  };
}

function deliveryFake({ notifications = [], preferences = [], users = [] } = {}) {
  const db = {
    notification: table(notifications),
    notificationAttempt: table(),
    notificationPreference: table(preferences),
    user: table(users),
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

const baseNotification = {
  id: "n1",
  userId: "u1",
  channel: "IN_APP",
  status: "QUEUED",
  kind: "SYSTEM",
  title: "Title 标题",
  titleEn: "Title",
  body: "私密正文 private body",
  bodyEn: "private body",
  actionUrl: "/en/dashboard",
  metadata: null,
  nextRetryAt: null,
  deadLetteredAt: null,
};

test("deliverNotification delivers IN_APP with a SUCCESS attempt", async () => {
  const db = deliveryFake({ notifications: [{ ...baseNotification }] });
  const result = await delivery.deliverNotification(db, { notificationId: "n1" });
  assert.equal(result.outcome, "DELIVERED");
  assert.equal(result.attempts, 1);
  assert.equal(db.notification.rows[0].status, "DELIVERED");
  assert.ok(db.notification.rows[0].deliveredAt);
  assert.equal(db.notificationAttempt.rows.length, 1);
  assert.equal(db.notificationAttempt.rows[0].result, "SUCCESS");
});

test("channel opted out is SKIPPED and dead-lettered without infinite retries", async () => {
  const db = deliveryFake({
    notifications: [{ ...baseNotification, id: "n2", channel: "EMAIL" }],
    preferences: [{ id: "p1", userId: "u1", emailEnabled: false, inAppEnabled: true, smsEnabled: false, marketingEnabled: false }],
    users: [{ id: "u1", email: "u1@example.com" }],
  });
  const result = await delivery.deliverNotification(db, { notificationId: "n2" });
  assert.equal(result.outcome, "SKIPPED");
  assert.equal(db.notificationAttempt.rows[0].result, "SKIPPED");
  assert.ok(db.notification.rows[0].deadLetteredAt, "跳过即死信，不无限重试");

  const again = await delivery.deliverNotification(db, { notificationId: "n2" });
  assert.equal(again.outcome, "DEAD", "死信幂等");
});

test("EMAIL failure retries with exponential backoff then dead-letters", async () => {
  // Empty synthetic mail configuration must fail before any transport is attempted.
  const db = deliveryFake({
    notifications: [{ ...baseNotification, id: "n3", channel: "EMAIL" }],
    users: [{ id: "u1", email: "u1@example.com" }],
  });
  const t0 = new Date("2026-09-19T00:00:00Z");
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await delivery.deliverNotification(db, { notificationId: "n3", maxAttempts: 5, baseBackoffMs: 1000, now: t0 });
    if (attempt < 5) {
      assert.equal(result.outcome, "RETRYING");
      assert.equal(
        db.notification.rows[0].nextRetryAt.toISOString(),
        new Date(t0.getTime() + 1000 * 2 ** (attempt - 1)).toISOString(),
        `第 ${attempt} 次退避 = base*2^${attempt - 1}`
      );
    } else {
      assert.equal(result.outcome, "DEAD");
    }
  }
  assert.equal(db.notificationAttempt.rows[0].result, "FAILED");
  assert.deepEqual(db.notificationAttempt.rows.map((row) => row.error), Array(5).fill("MailTransportError: MAIL_CONFIG_INVALID"), "persist only the fixed safe mail error classification");
  assert.equal(db.notification.rows[0].deadLetteredAt instanceof Date, true);
  assert.equal(db.notification.rows[0].nextRetryAt.toISOString(), new Date(t0.getTime() + 8000).toISOString(), "第 4 次退避保留 base*8");
  assert.equal(db.notificationAttempt.rows.length, 5);
});

test("missing notification 404 and unknown channels deliver as configured", async () => {
  const db = deliveryFake();
  const missing = await delivery.deliverNotification(db, { notificationId: "nope" });
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "NOTIFICATION_NOT_FOUND");

  const defaulted = await delivery.isChannelOptedOut(db, { userId: "any", channel: "SMS", marketing: false });
  assert.equal(defaulted, true, "SMS 默认关闭");
  const emailDefault = await delivery.isChannelOptedOut(db, { userId: "any", channel: "EMAIL", marketing: false });
  assert.equal(emailDefault, false, "EMAIL 默认开启");
  const marketingDefault = await delivery.isChannelOptedOut(db, { userId: "any", channel: "EMAIL", marketing: true });
  assert.equal(marketingDefault, true, "marketing 默认关闭");
});

test("processDueNotifications only processes due rows", async () => {
  const future = new Date(Date.now() + 60_000);
  const db = deliveryFake({
    notifications: [
      { ...baseNotification, id: "due1" },
      { ...baseNotification, id: "later", nextRetryAt: future },
      { ...baseNotification, id: "done", status: "DELIVERED" },
    ],
  });
  const totals = await delivery.processDueNotifications(db, { limit: 10 });
  assert.equal(totals.processed, 1);
  assert.equal(totals.delivered, 1);
  assert.equal(db.notification.rows.find((row) => row.id === "later").status, "QUEUED", "未到重试时间不处理");
});

test("email text carries title and locator only — private body never leaves the platform", () => {
  const source = fs.readFileSync("apps/passport-web/lib/server/notification-delivery.ts", "utf8");
  const mailBlock = source.match(/const subject =[\s\S]*?join\("\\n\\n"\);/);
  assert.ok(mailBlock, "mail text block exists");
  assert.match(mailBlock[0], /titleEn \?\? notification\.title/);
  assert.doesNotMatch(mailBlock[0], /notification\.body/, "邮件文本不得引用私密正文");
});

function reportsFake() {
  return {
    activityApplication: table([
      { activityId: "act-1", status: "SUBMITTED", userId: "u1" },
      { activityId: "act-1", status: "SUBMITTED", userId: "u2" },
      { activityId: "act-1", status: "APPROVED", userId: "u1" },
    ]),
    activityParticipation: table([
      { activityId: "act-1", status: "ACCEPTED", userId: "u1" },
      { activityId: "act-1", status: "CHECKED_IN", userId: "u3" },
    ]),
    activityCheckinRecord: table([
      { activityId: "act-1", id: "c1" },
      { activityId: "act-1", id: "c2" },
      { activityId: "act-1", id: "c3" },
      { activityId: "act-1", id: "c4" },
      { activityId: "act-1", id: "c5" },
    ]),
  };
}

test("activityPrivacyReport suppresses small cells and dedupes persons", async () => {
  const report = await reports.activityPrivacyReport(reportsFake(), { activityId: "act-1", threshold: 2 });
  assert.equal(report.threshold, 2);
  assert.equal(report.applicationsByStatus.SUBMITTED, 2);
  assert.equal(report.applicationsByStatus.APPROVED, null, "1 < 阈值 2 → 抑制");
  assert.equal(report.participationsByStatus.ACCEPTED, null);
  assert.equal(report.checkinCount, 5);
  assert.equal(report.distinctPersons, 3, "申请与参与并集去重");
  assert.ok(report.suppressedCells.includes("applications.APPROVED"));
  assert.ok(report.suppressedCells.includes("distinctPersons") === false);
});

test("activityPrivacyReport with a threshold of 1 keeps all cells", async () => {
  const report = await reports.activityPrivacyReport(reportsFake(), { activityId: "act-1", threshold: 1 });
  assert.equal(report.applicationsByStatus.APPROVED, 1);
  assert.equal(report.suppressedCells.length, 0);
});

function lifecycleFake() {
  const db = {
    user: table([
      {
        id: "u1",
        email: "self@example.com",
        name: "Self User",
        password: "hash",
        role: "ATTENDEE",
        status: "ACTIVE",
        salutation: "Mx",
        avatar: "a.png",
        phone: "123",
        title: "Dr",
        bio: "bio",
        country: "CN",
        resetToken: "rt",
        resetTokenExpiry: new Date(),
        anonymizedAt: null,
        anonymizedReason: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]),
    session: table([{ id: "s1", userId: "u1" }, { id: "s2", userId: "u1" }, { id: "s3", userId: "u2" }]),
    person: table([{ id: "p1", userId: "u1", displayName: "Self Person", orcid: "0000-0002", bio: "bio", verificationStatus: "VERIFIED" }]),
    scopedRecord: table([
      { id: "r1", ownerUserId: "u1", recordType: "lab.note", title: "Own record", status: "ACTIVE", currentRevision: 2, payloadJson: { note: "mine" } },
      { id: "r2", ownerUserId: "u1", recordType: "lab.note", title: "Second", status: "ACTIVE", currentRevision: 1, payloadJson: { note: "mine2" } },
      { id: "r3", ownerUserId: "u2", recordType: "lab.note", title: "Other author", status: "ACTIVE", currentRevision: 1, payloadJson: { note: "theirs" } },
    ]),
    consentRecord: table([{ id: "cn1", subjectUserId: "u1", purpose: "image_use", channel: null, status: "ACTIVE", version: 1, validFrom: new Date(), validUntil: null }]),
    controlledAsset: table([{ id: "a1", ownerUserId: "u1", fileName: "photo.jpg", contentType: "image/jpeg", byteSize: 10, sha256: "abc", purpose: "evidence", status: "FINALIZED" }]),
    contributionFact: table([{ id: "f1", personId: "p1", contributionType: "mentoring.minutes", verificationLevel: "SELF_REPORTED", status: "ACTIVE", summaryJson: { quantities: {} } }]),
    objectAuthorization: table([{ id: "g1", subjectUserId: "u1", grantorUserId: "u2", objectType: "ScopedRecord", objectId: "r3", purpose: "peer-review", validUntil: null }]),
    privacyMarker: table(),
    coreAuditLog: table(),
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

test("exportUserData exports owned materials and index-only grants, never other authors' content", async () => {
  const db = lifecycleFake();
  const result = await lifecycle.exportUserData(db, { userId: "u1" });
  assert.equal("error" in result, false);
  const data = result.export;

  assert.equal(data.records.length, 2, "只导出本人拥有的记录");
  assert.deepEqual(data.records[0].payloadJson, { note: "mine" }, "本人记录带正文");
  assert.equal(data.grantedRecordIndex.length, 1);
  assert.equal(data.grantedRecordIndex[0].objectId, "r3");
  assert.equal(data.grantedRecordIndex[0].payloadJson, undefined, "他人授予只出索引");
  assert.equal(data.otherAuthorsContentIncluded, false);
  assert.equal(data.assetIndex.length, 1);
  assert.equal(data.assetIndex[0].sha256, "abc", "资产索引含完整性哈希，不含内容");
  assert.equal(data.contributionFacts.length, 1);
  assert.equal(data.profile.email, "self@example.com");
});

test("deleteUserAccount anonymizes, revokes sessions, withdraws records and marks privacy markers", async () => {
  const db = lifecycleFake();
  const result = await lifecycle.deleteUserAccount(db, { userId: "u1", reason: "user request" });
  assert.equal("error" in result, false);
  assert.equal(result.withdrawnRecords, 2);
  assert.ok(result.retentionNotice.length >= 3, "受限保留说明");

  const user = db.user.rows[0];
  assert.equal(user.name, "Deleted user");
  assert.match(user.email, /^deleted-[a-f0-9]{24}@anonymized\.invalid$/);
  assert.equal(user.status, "SUSPENDED");
  assert.ok(user.anonymizedAt);
  assert.equal(user.bio, null);
  assert.equal(user.resetToken, null);
  assert.equal(db.session.rows.filter((row) => row.userId === "u1").length, 0, "会话吊销");

  const person = db.person.rows[0];
  assert.equal(person.displayName, "Deleted person");
  assert.equal(person.orcid, null);

  assert.ok(db.scopedRecord.rows.every((row) => row.ownerUserId !== "u1" || row.status === "WITHDRAWN"), "本人 ACTIVE 记录全部撤回");
  assert.equal(db.scopedRecord.rows.find((row) => row.id === "r3").status, "ACTIVE", "他人记录不受影响");
  assert.equal(db.privacyMarker.rows.length, 3, "两条记录撤回标记 + 一条用户删除标记");
  assert.equal(db.coreAuditLog.rows[0].action, "account.delete");

  const again = await lifecycle.deleteUserAccount(db, { userId: "u1", reason: "repeat" });
  assert.equal(again.withdrawnRecords, 0, "删除幂等");
});

test("replayPrivacyMarkers re-applies withdrawal/deletion after a restore and is idempotent", async () => {
  const db = lifecycleFake();
  await lifecycle.deleteUserAccount(db, { userId: "u1", reason: "user request" });

  // 模拟备份恢复把状态带回删除前
  db.user.rows[0].anonymizedAt = null;
  db.user.rows[0].name = "Self User";
  db.user.rows[0].email = "self@example.com";
  db.user.rows[0].status = "ACTIVE";
  db.session.rows.push({ id: "s-restored", userId: "u1" });
  for (const record of db.scopedRecord.rows) {
    if (record.ownerUserId === "u1") record.status = "ACTIVE";
  }

  const replayed = await lifecycle.replayPrivacyMarkers(db, {});
  assert.equal(replayed.replayed, 3);
  assert.equal(replayed.applied, 3, "恢复后重放：重新匿名化 + 重新撤回两条记录");
  assert.equal(db.user.rows[0].name, "Deleted user");
  assert.equal(db.session.rows.filter((row) => row.userId === "u1").length, 0, "重放再次吊销会话");
  assert.ok(db.scopedRecord.rows.filter((row) => row.ownerUserId === "u1").every((row) => row.status === "WITHDRAWN"));

  const second = await lifecycle.replayPrivacyMarkers(db, {});
  assert.equal(second.applied, 0);
  assert.equal(second.skipped, 3, "重放幂等");
});
