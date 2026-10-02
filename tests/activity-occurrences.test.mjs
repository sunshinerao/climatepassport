/**
 * 源码级测试：通用期次原子录取/候补、多角色指派、外部分类引用与出席更正（CP-TODO-246 / CP-FR-054/055/056）
 *
 * 覆盖（loadService 沙箱 + 内存 Prisma mock）：
 * - createOccurrence/updateOccurrence/cancelOccurrence：窗口与容量校验、CAS 取消、占用期次不可取消
 * - claimOccurrenceSeat/admitApplicationToOccurrence：原子占位、满员 409、取消 409、重复确认不占名额
 * - releaseSeatAndPromoteWaitlist：释放+按申请时间提升最早候补、无候补名额留空
 * - assignActivityPersonRole/listActivityPeople：幂等指派、角色校验、统计按人去重
 * - setActivityClassification/withdrawActivityClassification：幂等键+内容哈希、版本护栏、撤回/复活
 * - recordAttendanceCorrection：理由必填、不重复出席、状态机约束、不触发奖励
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./_service-loader.mjs";

const occurrences = loadService("apps/passport-web/lib/server/activity-occurrences.ts");
const personRoles = loadService("apps/passport-web/lib/server/activity-person-roles.ts");
const taxonomy = loadService("apps/passport-web/lib/server/activity-taxonomy.ts");
const participation = loadService("apps/passport-web/lib/server/activity-participation.ts");

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
      if ("increment" in condition) return true;
      if ("decrement" in condition) return true;
      if (row[key] === undefined) return matches(row, condition);
      return matches(row[key] ?? {}, condition);
    }
    return row[key] === condition;
  });
}

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) row[key] = (row[key] ?? 0) + value.increment;
    else if (value && typeof value === "object" && "decrement" in value) row[key] = (row[key] ?? 0) - value.decrement;
    else row[key] = value;
  }
}

function table(initial = []) {
  const rows = [...initial];
  return {
    rows,
    findUnique: async ({ where }) => rows.find((row) => matches(row, where)) ?? null,
    findFirst: async ({ where, orderBy } = {}) => {
      const found = rows.filter((row) => matches(row, where));
      if (orderBy?.createdAt === "asc") found.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return found[0] ?? null;
    },
    findMany: async ({ where } = {}) => rows.filter((row) => matches(row, where)),
    create: async ({ data }) => {
      const row = { id: `row-${rows.length + 1}`, createdAt: new Date(), updatedAt: new Date(), admittedCount: 0, status: "SCHEDULED", ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }) => {
      const row = rows.find((entry) => matches(entry, where));
      if (!row) throw new Error("row not found");
      applyData(row, data);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const targets = rows.filter((row) => matches(row, where));
      for (const row of targets) applyData(row, data);
      return { count: targets.length };
    },
    findUniqueOrThrow: async ({ where }) => {
      const row = rows.find((entry) => matches(entry, where));
      if (!row) throw new Error("row not found");
      return row;
    },
    delete: async ({ where }) => {
      const index = rows.findIndex((row) => matches(row, where));
      if (index >= 0) rows.splice(index, 1);
    },
  };
}

function occurrenceFake({ occurrences: seedOccurrences = [], applications = [], participations = [] } = {}) {
  const fake = {
    activityOccurrence: table(seedOccurrences),
    activityApplication: table(applications),
    activityParticipation: table(participations),
  };
  fake.$transaction = async (fn) => fn(fake);
  return fake;
}

const baseOccurrence = {
  id: "occ-1",
  activityId: "act-1",
  startsAt: new Date("2026-10-01T09:00:00Z"),
  endsAt: new Date("2026-10-01T12:00:00Z"),
  capacity: 1,
  admittedCount: 0,
  status: "SCHEDULED",
  locationJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

test("createOccurrence validates window and capacity", async () => {
  const fake = occurrenceFake();
  const badWindow = await occurrences.createOccurrence(fake, {
    activityId: "act-1",
    startsAt: new Date("2026-10-01T12:00:00Z"),
    endsAt: new Date("2026-10-01T09:00:00Z"),
  });
  assert.equal(badWindow.status, 400);
  const badCapacity = await occurrences.createOccurrence(fake, {
    activityId: "act-1",
    startsAt: baseOccurrence.startsAt,
    endsAt: baseOccurrence.endsAt,
    capacity: 0,
  });
  assert.equal(badCapacity.status, 400);
  const ok = await occurrences.createOccurrence(fake, {
    activityId: "act-1",
    startsAt: baseOccurrence.startsAt,
    endsAt: baseOccurrence.endsAt,
    capacity: 2,
  });
  assert.equal(ok.occurrence.status, "SCHEDULED");
  assert.equal(ok.occurrence.remainingCapacity, 2);
  const unlimited = await occurrences.createOccurrence(fake, {
    activityId: "act-1",
    startsAt: baseOccurrence.startsAt,
    endsAt: baseOccurrence.endsAt,
  });
  assert.equal(unlimited.occurrence.remainingCapacity, null);
});

test("admitApplicationToOccurrence claims exactly one seat and never exceeds capacity", async () => {
  const fake = occurrenceFake({
    occurrences: [{ ...baseOccurrence }],
    applications: [
      { id: "app-1", activityId: "act-1", userId: "user-1", status: "SUBMITTED", occurrenceId: null, roleType: "PARTICIPANT", createdAt: new Date("2026-09-01T00:00:00Z") },
      { id: "app-2", activityId: "act-1", userId: "user-2", status: "SUBMITTED", occurrenceId: null, roleType: null, createdAt: new Date("2026-09-02T00:00:00Z") },
    ],
  });
  const first = await occurrences.admitApplicationToOccurrence(fake, {
    applicationId: "app-1",
    activityId: "act-1",
    userId: "user-1",
    roleType: "PARTICIPANT",
    occurrenceId: "occ-1",
  });
  assert.equal("error" in first, false);
  assert.equal(first.participationCreated, true);
  assert.equal(fake.activityOccurrence.rows[0].admittedCount, 1);
  assert.equal(fake.activityApplication.rows[0].status, "APPROVED");
  assert.equal(fake.activityApplication.rows[0].occurrenceId, "occ-1");
  assert.equal(fake.activityParticipation.rows[0].status, "ACCEPTED");

  const second = await occurrences.admitApplicationToOccurrence(fake, {
    applicationId: "app-2",
    activityId: "act-1",
    userId: "user-2",
    roleType: null,
    occurrenceId: "occ-1",
  });
  assert.equal(second.code, "OCCURRENCE_FULL");
  assert.equal(second.status, 409);
  assert.equal(fake.activityOccurrence.rows[0].admittedCount, 1, "满员后 admittedCount 不超额");
  assert.equal(fake.activityApplication.rows.find((row) => row.id === "app-2").status, "SUBMITTED", "满员不产生第二条确认");

  const duplicateConfirm = await occurrences.admitApplicationToOccurrence(fake, {
    applicationId: "app-1",
    activityId: "act-1",
    userId: "user-1",
    roleType: null,
    occurrenceId: "occ-1",
  });
  assert.equal(duplicateConfirm.status, 409);
  assert.equal(fake.activityOccurrence.rows[0].admittedCount, 1, "重复确认归还名额，净占用不变");
});

test("admission rejects cancelled and unknown occurrences; unlimited capacity admits freely", async () => {
  const fake = occurrenceFake({
    occurrences: [
      { ...baseOccurrence, id: "occ-cancelled", status: "CANCELLED" },
      { ...baseOccurrence, id: "occ-unlimited", capacity: null },
    ],
    applications: [
      { id: "app-x", activityId: "act-1", userId: "user-x", status: "SUBMITTED", occurrenceId: null, roleType: null, createdAt: new Date() },
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `app-u-${index}`,
        activityId: "act-1",
        userId: `user-u-${index}`,
        status: "SUBMITTED",
        occurrenceId: null,
        roleType: null,
        createdAt: new Date(Date.UTC(2026, 8, 10 + index)),
      })),
    ],
  });
  const cancelled = await occurrences.admitApplicationToOccurrence(fake, {
    applicationId: "app-x",
    activityId: "act-1",
    userId: "user-x",
    roleType: null,
    occurrenceId: "occ-cancelled",
  });
  assert.equal(cancelled.code, "OCCURRENCE_UNAVAILABLE");
  const missing = await occurrences.admitApplicationToOccurrence(fake, {
    applicationId: "app-x",
    activityId: "act-1",
    userId: "user-x",
    roleType: null,
    occurrenceId: "occ-missing",
  });
  assert.equal(missing.code, "OCCURRENCE_NOT_FOUND");

  for (let index = 0; index < 5; index += 1) {
    const admitted = await occurrences.admitApplicationToOccurrence(fake, {
      applicationId: `app-u-${index}`,
      activityId: "act-1",
      userId: `user-u-${index}`,
      roleType: null,
      occurrenceId: "occ-unlimited",
    });
    assert.equal("error" in admitted, false);
  }
  assert.equal(fake.activityOccurrence.rows.find((row) => row.id === "occ-unlimited").admittedCount, 5);
});

test("releaseSeatAndPromoteWaitlist promotes the earliest waitlisted application", async () => {
  const admittedAt = new Date("2026-09-01T00:00:00Z");
  const fake = occurrenceFake({
    occurrences: [{ ...baseOccurrence, admittedCount: 1 }],
    applications: [
      { id: "app-approved", activityId: "act-1", userId: "user-1", status: "APPROVED", occurrenceId: "occ-1", roleType: null, createdAt: admittedAt },
      { id: "app-wait-1", activityId: "act-1", userId: "user-2", status: "WAITLISTED", occurrenceId: "occ-1", roleType: null, createdAt: new Date("2026-09-02T00:00:00Z") },
      { id: "app-wait-2", activityId: "act-1", userId: "user-3", status: "WAITLISTED", occurrenceId: "occ-1", roleType: null, createdAt: new Date("2026-09-03T00:00:00Z") },
    ],
    participations: [{ id: "part-1", activityId: "act-1", userId: "user-1", status: "ACCEPTED", roleType: null }],
  });

  const released = await occurrences.releaseSeatAndPromoteWaitlist(fake, { activityId: "act-1", occurrenceId: "occ-1" });
  assert.equal("error" in released, false);
  assert.equal(released.promoted.applicationId, "app-wait-1", "最早候补优先转正");
  assert.equal(fake.activityApplication.rows.find((row) => row.id === "app-wait-1").status, "APPROVED");
  assert.equal(fake.activityApplication.rows.find((row) => row.id === "app-wait-2").status, "WAITLISTED");
  assert.equal(fake.activityOccurrence.rows[0].admittedCount, 1, "释放后转正再占位，总额不变");
  assert.ok(fake.activityParticipation.rows.some((row) => row.userId === "user-2" && row.status === "ACCEPTED"));
});

test("releaseSeatAndPromoteWaitlist leaves the seat empty when no waitlist exists", async () => {
  const fake = occurrenceFake({
    occurrences: [{ ...baseOccurrence, admittedCount: 1 }],
    applications: [{ id: "app-approved", activityId: "act-1", userId: "user-1", status: "APPROVED", occurrenceId: "occ-1", roleType: null, createdAt: new Date() }],
  });
  const released = await occurrences.releaseSeatAndPromoteWaitlist(fake, { activityId: "act-1", occurrenceId: "occ-1" });
  assert.equal(released.promoted, null);
  assert.equal(fake.activityOccurrence.rows[0].admittedCount, 0);
});

test("cancelOccurrence refuses occupied occurrences and is single-use", async () => {
  const fake = occurrenceFake({
    occurrences: [
      { ...baseOccurrence, id: "occ-busy", admittedCount: 1 },
      { ...baseOccurrence, id: "occ-empty" },
    ],
  });
  const busy = await occurrences.cancelOccurrence(fake, "occ-busy");
  assert.equal(busy.code, "OCCURRENCE_UNAVAILABLE");
  const cancelled = await occurrences.cancelOccurrence(fake, "occ-empty");
  assert.equal(cancelled.occurrence.status, "CANCELLED");
  const again = await occurrences.cancelOccurrence(fake, "occ-empty");
  assert.equal(again.code, "OCCURRENCE_UNAVAILABLE");
});

test("updateOccurrence cannot cancel an occupied occurrence and validates capacity (code-review hardening)", async () => {
  const fake = occurrenceFake({
    occurrences: [
      { ...baseOccurrence, id: "occ-busy-update", capacity: 3, admittedCount: 2 },
      { ...baseOccurrence, id: "occ-empty-update" },
    ],
  });
  const cancelBusy = await occurrences.updateOccurrence(fake, { occurrenceId: "occ-busy-update", status: "CANCELLED" });
  assert.equal(cancelBusy.status, 409, "占用期次不可经 updateOccurrence 取消（与 cancelOccurrence 同一护栏）");
  assert.equal(cancelBusy.code, "OCCURRENCE_UNAVAILABLE");

  const zeroCapacity = await occurrences.updateOccurrence(fake, { occurrenceId: "occ-empty-update", capacity: 0 });
  assert.equal(zeroCapacity.status, 400, "capacity 必须为正整数");
  const negative = await occurrences.updateOccurrence(fake, { occurrenceId: "occ-empty-update", capacity: -2 });
  assert.equal(negative.status, 400);

  const ok = await occurrences.updateOccurrence(fake, { occurrenceId: "occ-busy-update", capacity: 2 });
  assert.equal("error" in ok, false);
  assert.equal(ok.occurrence.capacity, 2);
});

test("admission fails closed when the occurrence belongs to another activity", async () => {
  const fake = occurrenceFake({
    occurrences: [{ ...baseOccurrence, activityId: "act-B" }],
    applications: [{ id: "app-x", activityId: "act-A", userId: "user-x", status: "SUBMITTED", occurrenceId: null, roleType: null, createdAt: new Date() }],
  });
  const admitted = await occurrences.admitApplicationToOccurrence(fake, {
    applicationId: "app-x",
    activityId: "act-A",
    userId: "user-x",
    roleType: null,
    occurrenceId: "occ-1",
  });
  assert.equal(admitted.code, "OCCURRENCE_NOT_FOUND", "跨活动占位失败关闭");
  assert.equal(fake.activityOccurrence.rows[0].admittedCount, 0, "未发生占位");
});

test("admission with an existing participation is idempotent", async () => {
  const fake = occurrenceFake({
    occurrences: [{ ...baseOccurrence, capacity: 5 }],
    applications: [{ id: "app-p", activityId: "act-1", userId: "user-1", status: "SUBMITTED", occurrenceId: null, roleType: null, createdAt: new Date() }],
    participations: [{ id: "part-existing", activityId: "act-1", userId: "user-1", status: "ACCEPTED", roleType: null }],
  });
  const admitted = await occurrences.admitApplicationToOccurrence(fake, {
    applicationId: "app-p",
    activityId: "act-1",
    userId: "user-1",
    roleType: null,
    occurrenceId: "occ-1",
  });
  assert.equal("error" in admitted, false);
  assert.equal(admitted.participationCreated, false, "已有参与记录时不重复创建");
  assert.equal(fake.activityParticipation.rows.length, 1);
});

test("updateOccurrence refuses shrinking capacity below the admitted count", async () => {
  const fake = occurrenceFake({ occurrences: [{ ...baseOccurrence, capacity: 3, admittedCount: 2 }] });
  const shrunk = await occurrences.updateOccurrence(fake, { occurrenceId: "occ-1", capacity: 1 });
  assert.equal(shrunk.code, "OCCURRENCE_FULL");
  const ok = await occurrences.updateOccurrence(fake, { occurrenceId: "occ-1", capacity: 2 });
  assert.equal(ok.occurrence.capacity, 2);
  const frozen = await occurrences.updateOccurrence(fake, { occurrenceId: "occ-1", capacity: 5, startsAt: new Date("2026-10-02T09:00:00Z") });
  assert.equal(frozen.status, 400);
});

test("assignActivityPersonRole validates role type and is idempotent per person and role", async () => {
  const fake = {
    person: table([{ id: "person-1" }]),
    activityPersonRole: table(),
  };
  const invalid = await personRoles.assignActivityPersonRole(fake, { activityId: "act-1", personId: "person-1", roleType: "VIP" });
  assert.equal(invalid.status, 400);
  const missingPerson = await personRoles.assignActivityPersonRole(fake, { activityId: "act-1", personId: "person-x", roleType: "SPEAKER" });
  assert.equal(missingPerson.status, 404);

  const first = await personRoles.assignActivityPersonRole(fake, { activityId: "act-1", personId: "person-1", roleType: "SPEAKER", createdByUserId: "admin-1" });
  assert.equal(first.created, true);
  const again = await personRoles.assignActivityPersonRole(fake, { activityId: "act-1", personId: "person-1", roleType: "SPEAKER" });
  assert.equal(again.created, false);
  assert.equal(fake.activityPersonRole.rows.length, 1, "同一 (activity, person, roleType) 只有一条指派");
});

test("listActivityPeople deduplicates statistics across roles", async () => {
  const fake = {
    person: table([{ id: "person-1" }, { id: "person-2" }]),
    activityPersonRole: table([
      { id: "r1", activityId: "act-1", personId: "person-1", roleType: "SPEAKER", sourceType: null, sourceId: null, note: null, createdAt: new Date("2026-09-01T00:00:00Z") },
      { id: "r2", activityId: "act-1", personId: "person-1", roleType: "MODERATOR", sourceType: null, sourceId: null, note: null, createdAt: new Date("2026-09-02T00:00:00Z") },
      { id: "r3", activityId: "act-1", personId: "person-2", roleType: "MENTOR", sourceType: null, sourceId: null, note: null, createdAt: new Date("2026-09-03T00:00:00Z") },
    ]),
  };
  const people = await personRoles.listActivityPeople(fake, "act-1");
  assert.equal(people.totalAssignments, 3);
  assert.equal(people.distinctPersonCount, 2, "一人多角色不双计");
  assert.equal(people.roles.length, 3);
});

function taxonomyFake({ activities = [{ id: "act-1" }], classifications = [] } = {}) {
  const fake = {
    activity: table(activities),
    activityExternalClassification: table(classifications),
    coreAuditLog: table(),
  };
  fake.$transaction = async (fn) => fn(fake);
  return fake;
}

test("setActivityClassification creates with audit and dedupes on idempotency key", async () => {
  const fake = taxonomyFake();
  const first = await taxonomy.setActivityClassification(fake, {
    activityId: "act-1",
    taxonomySystem: "un-sdgs",
    taxonomyRef: "13",
    labelJson: { label: "Climate Action" },
    sourceVersion: 1,
    idempotencyKey: "key-1",
  });
  assert.equal(first.deduplicated, false);
  assert.equal(first.classification.status, "ACTIVE");
  assert.equal(fake.coreAuditLog.rows.length, 1);
  assert.equal(fake.coreAuditLog.rows[0].action, "activity_taxonomy.set");

  const replay = await taxonomy.setActivityClassification(fake, {
    activityId: "act-1",
    taxonomySystem: "un-sdgs",
    taxonomyRef: "13",
    labelJson: { label: "Climate Action" },
    sourceVersion: 1,
    idempotencyKey: "key-1",
  });
  assert.equal(replay.deduplicated, true);
  assert.equal(fake.activityExternalClassification.rows.length, 1);

  const conflict = await taxonomy.setActivityClassification(fake, {
    activityId: "act-1",
    taxonomySystem: "un-sdgs",
    taxonomyRef: "13",
    labelJson: { label: "Changed" },
    sourceVersion: 1,
    idempotencyKey: "key-1",
  });
  assert.equal(conflict.code, "TAXONOMY_CONFLICT");
});

test("setActivityClassification enforces monotonic versions and idempotent same-version replay", async () => {
  const fake = taxonomyFake();
  await taxonomy.setActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    labelJson: { label: "v1" }, sourceVersion: 1, idempotencyKey: "key-1",
  });
  const stale = await taxonomy.setActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    labelJson: { label: "v0" }, sourceVersion: 1 - 1 + 0, idempotencyKey: "key-stale",
  });
  assert.equal(stale.code, "TAXONOMY_STALE");

  const sameVersionSameContent = await taxonomy.setActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    labelJson: { label: "v1" }, sourceVersion: 1, idempotencyKey: "key-2",
  });
  assert.equal(sameVersionSameContent.deduplicated, true);

  const sameVersionDifferentContent = await taxonomy.setActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    labelJson: { label: "different" }, sourceVersion: 1, idempotencyKey: "key-3",
  });
  assert.equal(sameVersionDifferentContent.code, "TAXONOMY_CONFLICT");

  const upgraded = await taxonomy.setActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    labelJson: { label: "v2" }, sourceVersion: 2, idempotencyKey: "key-4",
  });
  assert.equal(upgraded.deduplicated, false);
  assert.equal(upgraded.classification.sourceVersion, 2);
  assert.equal(fake.activityExternalClassification.rows.length, 1);

  const missing = await taxonomy.setActivityClassification(fake, {
    activityId: "act-missing", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    sourceVersion: 1, idempotencyKey: "key-5",
  });
  assert.equal(missing.status, 404);
});

test("withdrawActivityClassification is versioned, idempotent and re-activatable by a newer version", async () => {
  const fake = taxonomyFake();
  await taxonomy.setActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    labelJson: { label: "v1" }, sourceVersion: 1, idempotencyKey: "key-1",
  });

  const missing = await taxonomy.withdrawActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "99",
    sourceVersion: 1, idempotencyKey: "key-missing",
  });
  assert.equal(missing.code, "TAXONOMY_NOT_FOUND");

  const stale = await taxonomy.withdrawActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    sourceVersion: 0, idempotencyKey: "key-stale",
  });
  assert.equal(stale.code, "TAXONOMY_STALE");

  const withdrawn = await taxonomy.withdrawActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    sourceVersion: 1, idempotencyKey: "key-w1",
  });
  assert.equal(withdrawn.deduplicated, false);
  assert.equal(withdrawn.classification.status, "WITHDRAWN");
  assert.equal(fake.coreAuditLog.rows.at(-1).action, "activity_taxonomy.withdraw");

  const again = await taxonomy.withdrawActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    sourceVersion: 1, idempotencyKey: "key-w2",
  });
  assert.equal(again.deduplicated, true);

  const restored = await taxonomy.setActivityClassification(fake, {
    activityId: "act-1", taxonomySystem: "un-sdgs", taxonomyRef: "13",
    labelJson: { label: "v2" }, sourceVersion: 2, idempotencyKey: "key-r1",
  });
  assert.equal(restored.classification.status, "ACTIVE");
  assert.equal(restored.classification.sourceVersion, 2);
});

function correctionFake(participations) {
  return {
    activityParticipation: table(participations),
    activityCheckinRecord: table(),
  };
}

test("recordAttendanceCorrection requires a reason and never duplicates attendance", async () => {
  const fake = correctionFake([{ id: "part-1", activityId: "act-1", userId: "user-1", status: "ABSENT" }]);

  const noReason = await participation.recordAttendanceCorrection(fake, { participationId: "part-1", reason: "  " });
  assert.equal(noReason.code, "ATTENDANCE_CORRECTION_REASON_REQUIRED");
  assert.equal(noReason.status, 400);

  const corrected = await participation.recordAttendanceCorrection(fake, {
    participationId: "part-1",
    reason: "现场纸质签到补录",
    evidenceAssetIds: ["asset-1"],
    actorUserId: "manager-1",
  });
  assert.equal(corrected.rewardsTriggered, false, "补录不触发奖励");
  assert.equal(fake.activityParticipation.rows[0].status, "CHECKED_IN");
  assert.equal(fake.activityCheckinRecord.rows.length, 1);
  assert.equal(fake.activityCheckinRecord.rows[0].isCorrection, true);
  assert.equal(fake.activityCheckinRecord.rows[0].method, "MANUAL");
  assert.equal(fake.activityCheckinRecord.rows[0].noteJson.reason, "现场纸质签到补录");
  assert.deepEqual(fake.activityCheckinRecord.rows[0].noteJson.evidenceAssetIds, ["asset-1"]);

  const duplicate = await participation.recordAttendanceCorrection(fake, { participationId: "part-1", reason: "重复补录" });
  assert.equal(duplicate.code, "ATTENDANCE_ALREADY_RECORDED");
  assert.equal(fake.activityCheckinRecord.rows.length, 1, "不重复记录出席");
});

test("recordAttendanceCorrection respects the participation state machine", async () => {
  const fake = correctionFake([
    { id: "part-archived", activityId: "act-1", userId: "user-1", status: "ARCHIVED" },
    { id: "part-missing", activityId: "act-1", userId: "user-2", status: "REGISTERED" },
  ]);
  const archived = await participation.recordAttendanceCorrection(fake, { participationId: "part-archived", reason: "尝试更正" });
  assert.equal(archived.status, 409);
  assert.equal(archived.code, "INVALID_REQUEST");

  const missing = await participation.recordAttendanceCorrection(fake, { participationId: "part-unknown", reason: "尝试更正" });
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "PARTICIPATION_NOT_FOUND");
});
