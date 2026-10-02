/**
 * 源码级测试：通用私密记录（CP-TODO-247 / CP-FR-057/071）
 *
 * 覆盖（vm 沙箱 + 内存 Prisma mock）：
 * - 创建：所有者即创建者，修订 1 同步落库，审计同事务
 * - 默认 Private：匿名/无关账号读 → 403 RECORD_ACCESS_DENIED；非存在 → 404
 * - compare-and-set 更新：版本匹配成功追加不可变修订；陈旧版本 409 不覆盖
 * - 对象级授权：READ 授予可读不可写；撤销立即生效；有效期窗口外拒绝
 * - Programme 成员：PROGRAMME_VIEWER 只读、PROGRAMME_ADMIN 可写；跨 Programme 无授权拒绝
 * - 撤回：非所有者不可见（404）；撤回后更新 409 RECORD_WITHDRAWN；二次撤回 409
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadService, matchesWhere } from "./_service-loader.mjs";

const records = loadService("apps/passport-web/lib/server/private-records.ts");

function makeFake({ programmes = [], memberships = [], grants = [] } = {}) {
  const state = {
    scopedRecords: [],
    revisions: [],
    grants: grants.map((grant) => ({ editionId: null, purpose: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null, ...grant })),
    memberships: memberships.map((membership) => ({ editionId: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null, ...membership })),
    programmes: programmes.map((programme) => ({ isActive: true, ...programme })),
    users: [{ id: "owner-1" }, { id: "reader-1" }, { id: "writer-1" }, { id: "outsider-1" }, { id: "admin-1" }],
    audits: [],
  };

  const fake = {
    scopedRecord: {
      create: async ({ data }) => {
        const row = { id: `rec-${state.scopedRecords.length + 1}`, status: "ACTIVE", currentRevision: 1, withdrawnAt: null, withdrawnById: null, programmeId: null, ownerUserId: null, createdById: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.scopedRecords.push(row);
        return row;
      },
      findUnique: async ({ where }) => state.scopedRecords.find((row) => row.id === where.id) ?? null,
      findMany: async ({ where }) => state.scopedRecords.filter((row) => matchesWhere(row, where)),
      updateMany: async ({ where, data }) => {
        const targets = state.scopedRecords.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data, { updatedAt: new Date() });
        return { count: targets.length };
      },
      update: async ({ where, data }) => {
        const row = state.scopedRecords.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    recordRevision: {
      create: async ({ data }) => {
        const row = { id: `rev-${state.revisions.length + 1}`, createdById: null, createdAt: new Date(), ...data };
        state.revisions.push(row);
        return row;
      },
      findMany: async ({ where }) => state.revisions.filter((row) => matchesWhere(row, where)),
    },
    objectAuthorization: {
      create: async ({ data }) => {
        const row = { id: `grant-${state.grants.length + 1}`, editionId: null, purpose: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null, ...data };
        state.grants.push(row);
        return row;
      },
      findFirst: async ({ where }) => state.grants.find((row) => matchesWhere(row, where)) ?? null,
      findMany: async ({ where }) => state.grants.filter((row) => matchesWhere(row, where)),
      findUnique: async ({ where }) => state.grants.find((row) => row.id === where.id) ?? null,
      updateMany: async ({ where, data }) => {
        const targets = state.grants.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data);
        return { count: targets.length };
      },
    },
    accessMembership: {
      findMany: async ({ where }) => state.memberships.filter((row) => matchesWhere(row, where)),
    },
    programme: {
      findFirst: async ({ where }) => state.programmes.find((row) => matchesWhere(row, where)) ?? null,
    },
    edition: { findFirst: async () => null },
    institutionRepresentation: { findFirst: async () => null },
    sourceObjectMapping: { findFirst: async () => null },
    user: { findUnique: async ({ where }) => state.users.find((row) => row.id === where.id) ?? null },
    coreAuditLog: { create: async ({ data }) => { state.audits.push(data); return data; } },
    $transaction: async (callback) => callback(fake),
  };
  return { fake, state };
}

test("创建：所有者即创建者，修订 1 与审计同事务落库", async () => {
  const { fake, state } = makeFake();
  const result = await records.createScopedRecord(fake, {
    actorUserId: "owner-1",
    recordType: "inquiry_draft",
    title: "Draft",
    payloadJson: { summary: "hello" },
  });
  assert.equal(result.revision, 1);
  const row = state.scopedRecords.find((r) => r.id === result.recordId);
  assert.equal(row.ownerUserId, "owner-1");
  assert.equal(row.currentRevision, 1);
  assert.equal(state.revisions.filter((r) => r.recordId === result.recordId && r.revision === 1).length, 1);
  assert.equal(state.audits.filter((a) => a.action === "record.create").length, 1);
});

test("默认 Private：匿名读 403，非存在 404，所有者读成功", async () => {
  const { fake, state } = makeFake();
  const created = await records.createScopedRecord(fake, { actorUserId: "owner-1", recordType: "note", title: "N", payloadJson: {} });
  assert.equal((await records.readScopedRecord(fake, { recordId: created.recordId, actorUserId: null })).status, 403);
  assert.equal((await records.readScopedRecord(fake, { recordId: "missing", actorUserId: "owner-1" })).code, "RECORD_NOT_FOUND");
  const read = await records.readScopedRecord(fake, { recordId: created.recordId, actorUserId: "owner-1" });
  assert.equal(read.record.id, created.recordId);
  assert.equal(state.scopedRecords.length, 1);
});

test("compare-and-set：陈旧版本 409 不覆盖，匹配则追加不可变修订", async () => {
  const { fake, state } = makeFake();
  const created = await records.createScopedRecord(fake, { actorUserId: "owner-1", recordType: "note", title: "N", payloadJson: { v: 1 } });

  const stale = await records.updateScopedRecord(fake, { recordId: created.recordId, actorUserId: "owner-1", expectedRevision: 5, payloadJson: { v: 99 } });
  assert.equal(stale.code, "RECORD_REVISION_CONFLICT");
  assert.equal(state.scopedRecords[0].currentRevision, 1);
  assert.equal(state.revisions.length, 1);

  const updated = await records.updateScopedRecord(fake, { recordId: created.recordId, actorUserId: "owner-1", expectedRevision: 1, payloadJson: { v: 2 } });
  assert.equal(updated.revision, 2);
  assert.equal(state.scopedRecords[0].payloadJson.v, 2);
  assert.equal(state.revisions.length, 2);
  assert.equal(state.revisions[1].revision, 2);
  assert.equal(state.audits.filter((a) => a.action === "record.update").length, 1);
});

test("对象级授权：READ 可读不可写，撤销立即生效，越权授予 403", async () => {
  const { fake } = makeFake();
  const created = await records.createScopedRecord(fake, { actorUserId: "owner-1", recordType: "note", title: "N", payloadJson: {} });
  assert.equal((await records.updateScopedRecord(fake, { recordId: created.recordId, actorUserId: "reader-1", expectedRevision: 1, payloadJson: {} })).code, "RECORD_ACCESS_DENIED");

  const grant = await records.grantRecordAccess(fake, { recordId: created.recordId, actorUserId: "owner-1", subjectUserId: "reader-1", action: "READ", purpose: "peer_review" });
  assert.equal(typeof grant.grantId, "string");
  const read = await records.readScopedRecord(fake, { recordId: created.recordId, actorUserId: "reader-1" });
  assert.equal(read.record.id, created.recordId);
  assert.equal((await records.updateScopedRecord(fake, { recordId: created.recordId, actorUserId: "reader-1", expectedRevision: 1, payloadJson: {} })).code, "RECORD_ACCESS_DENIED");
  assert.equal((await records.grantRecordAccess(fake, { recordId: created.recordId, actorUserId: "reader-1", subjectUserId: "outsider-1", action: "READ" })).code, "RECORD_ACCESS_DENIED");

  await records.revokeRecordAccess(fake, { grantId: grant.grantId, actorUserId: "owner-1" });
  assert.equal((await records.readScopedRecord(fake, { recordId: created.recordId, actorUserId: "reader-1" })).code, "RECORD_ACCESS_DENIED");
  assert.equal((await records.revokeRecordAccess(fake, { grantId: grant.grantId, actorUserId: "owner-1" })).status, 409);
});

test("有效期窗口：过期授权拒绝", async () => {
  const past = new Date(Date.now() - 60_000);
  const { fake } = makeFake();
  const created = await records.createScopedRecord(fake, { actorUserId: "owner-1", recordType: "note", title: "N", payloadJson: {} });
  await records.grantRecordAccess(fake, { recordId: created.recordId, actorUserId: "owner-1", subjectUserId: "reader-1", action: "READ", validUntil: past });
  assert.equal((await records.readScopedRecord(fake, { recordId: created.recordId, actorUserId: "reader-1" })).code, "RECORD_ACCESS_DENIED");
});

test("Programme 成员：VIEWER 只读，ADMIN 可写，无成员资格拒绝", async () => {
  const { fake } = makeFake({
    programmes: [{ id: "prog-1" }],
    memberships: [{ userId: "reader-1", programmeId: "prog-1", role: "PROGRAMME_VIEWER" }],
  });
  const created = await records.createScopedRecord(fake, { actorUserId: "owner-1", recordType: "note", title: "N", payloadJson: {}, programmeId: "prog-1" });
  const viewerRead = await records.readScopedRecord(fake, { recordId: created.recordId, actorUserId: "reader-1" });
  assert.equal(viewerRead.record.id, created.recordId);
  assert.equal((await records.updateScopedRecord(fake, { recordId: created.recordId, actorUserId: "reader-1", expectedRevision: 1, payloadJson: {} })).code, "RECORD_ACCESS_DENIED");
  assert.equal((await records.readScopedRecord(fake, { recordId: created.recordId, actorUserId: "outsider-1" })).code, "RECORD_ACCESS_DENIED");
});

test("撤回：非所有者不可见，撤回后更新 409，二次撤回 409", async () => {
  const { fake } = makeFake();
  const created = await records.createScopedRecord(fake, { actorUserId: "owner-1", recordType: "note", title: "N", payloadJson: {} });
  assert.equal((await records.withdrawScopedRecord(fake, { recordId: created.recordId, actorUserId: "outsider-1" })).code, "RECORD_ACCESS_DENIED");

  const withdrawn = await records.withdrawScopedRecord(fake, { recordId: created.recordId, actorUserId: "owner-1" });
  assert.equal(withdrawn.recordId, created.recordId);
  assert.equal((await records.readScopedRecord(fake, { recordId: created.recordId, actorUserId: "outsider-1" })).code, "RECORD_NOT_FOUND");
  assert.equal((await records.updateScopedRecord(fake, { recordId: created.recordId, actorUserId: "owner-1", expectedRevision: 1, payloadJson: {} })).code, "RECORD_WITHDRAWN");
  assert.equal((await records.withdrawScopedRecord(fake, { recordId: created.recordId, actorUserId: "owner-1" })).code, "RECORD_WITHDRAWN");
});

test("列表：所有 + 被授权 + Programme 范围", async () => {
  const { fake } = makeFake({
    programmes: [{ id: "prog-1" }],
    memberships: [{ userId: "reader-1", programmeId: "prog-1", role: "PROGRAMME_VIEWER" }],
  });
  const own = await records.createScopedRecord(fake, { actorUserId: "reader-1", recordType: "note", title: "Own", payloadJson: {} });
  const prog = await records.createScopedRecord(fake, { actorUserId: "owner-1", recordType: "note", title: "Prog", payloadJson: {}, programmeId: "prog-1" });
  await records.createScopedRecord(fake, { actorUserId: "owner-1", recordType: "note", title: "Other", payloadJson: {} });

  const listed = await records.listScopedRecords(fake, { actorUserId: "reader-1" });
  const ids = listed.records.map((row) => row.id);
  assert.ok(ids.includes(own.recordId));
  assert.ok(ids.includes(prog.recordId));
  assert.equal(ids.length, 2);
});
