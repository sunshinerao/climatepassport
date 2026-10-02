/**
 * 源码级测试：按版本发布/撤回与 fail-closed 公开读门（CP-TODO-251 / CP-FR-061/068）
 *
 * 覆盖（vm 沙箱 + 内存 Prisma mock，级联转译 consents/private-records/
 * programme-scope/external-decision-receipts/reliable-dispatch）：
 * - publishProjection：scoped_record 非所有者/无授权 → 403 RECORD_ACCESS_DENIED；
 *   所有者发 v1 成功；同版本同内容 → deduplicated=true；同版本异内容 → 409
 *   PUBLICATION_CONFLICT；已撤回版本再发布 → 409 PUBLICATION_RESTORE_FORBIDDEN
 * - 发新版不下架旧版：默认读门返回最新已发布版，指定 version 仍返回旧版
 * - withdrawProjection：所有者撤回成功且读门立即失效（null）；重复撤回幂等
 *   （不再入队/审计）；乱序安全：撤回 v1 后 v2 仍可读
 * - 同意门：缺失同意 → 403 CONSENT_REQUIRED；授予后撤回 → 403 CONSENT_WITHDRAWN；
 *   有效同意放行；频道规则（consent.channel 限定其它频道时该频道发布 403）
 * - approvalReceipt 门：无回执 → 403 RECEIPT_ISSUER_UNVERIFIED；APPROVED 且
 *   objectRevision>=version → 成功；版本不足或最新回执为 REJECTED → 403
 * - dispatch 扇出：发布/撤回各向 dispatch:publications 的 MACHINE 客户端入队；
 *   payload 只含定位信息（projectionHash/版本/状态），不含 projectionJson 正文；
 *   revision=版本；idempotencyKey 含对象与版本
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadService, matchesWhere } from "./_service-loader.mjs";

const gateway = loadService("apps/passport-web/lib/server/publication-gateway.ts");
const consents = loadService("apps/passport-web/lib/server/consents.ts");

const PAST = new Date("2020-01-01T00:00:00.000Z");
const PUB_CLIENT = { id: "client-1", key: "FSV1PUB", isActive: true, type: "MACHINE", callbackUrl: "https://cb.example/hook", allowedScopes: ["dispatch:publications"] };

/** 极简 orderBy 支持：单 clause 或数组，字段值为 Date/number/string。 */
function applyOrderBy(rows, orderBy) {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      for (const [key, dir] of Object.entries(clause)) {
        if (a[key] === b[key]) continue;
        const cmp = a[key] < b[key] ? -1 : 1;
        return dir === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function makeFake({ programmes = [], memberships = [], grants = [], clients = [], receipts = [] } = {}) {
  const state = {
    publications: [],
    scopedRecords: [],
    revisions: [],
    grants: grants.map((grant, index) => ({ id: `grant-${index + 1}`, editionId: null, purpose: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null, ...grant })),
    memberships: memberships.map((membership, index) => ({ id: `membership-${index + 1}`, editionId: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null, ...membership })),
    programmes: programmes.map((programme) => ({ isActive: true, ...programme })),
    receipts: receipts.map((receipt, index) => ({ id: `rcpt-${index + 1}`, programmeId: null, signature: null, contentHash: `hash-${index + 1}`, minimalJson: {}, validUntil: null, receivedAt: new Date(), ...receipt })),
    consents: [],
    clients,
    dispatches: [],
    audits: [],
    users: [{ id: "owner-1" }, { id: "subject-1" }, { id: "admin-1" }, { id: "viewer-1" }, { id: "outsider-1" }],
  };

  const fake = {
    publicationProjection: {
      create: async ({ data }) => {
        const row = { id: `pub-${state.publications.length + 1}`, status: "PUBLISHED", withdrawnAt: null, withdrawnById: null, publishedById: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.publications.push(row);
        return row;
      },
      findUnique: async ({ where }) => {
        // 复合键 objectType_objectId_version 需手工解构匹配（matchesWhere 不支持）。
        if (where.objectType_objectId_version) {
          const { objectType, objectId, version } = where.objectType_objectId_version;
          return state.publications.find((row) => row.objectType === objectType && row.objectId === objectId && row.version === version) ?? null;
        }
        return state.publications.find((row) => row.id === where.id) ?? null;
      },
      findFirst: async ({ where, orderBy } = {}) => applyOrderBy(state.publications.filter((row) => matchesWhere(row, where)), orderBy)[0] ?? null,
      findMany: async ({ where, orderBy, take } = {}) => applyOrderBy(state.publications.filter((row) => matchesWhere(row, where)), orderBy).slice(0, take ?? 100),
      updateMany: async ({ where, data }) => {
        const targets = state.publications.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data, { updatedAt: new Date() });
        return { count: targets.length };
      },
    },
    scopedRecord: {
      create: async ({ data }) => {
        const row = { id: `rec-${state.scopedRecords.length + 1}`, status: "ACTIVE", currentRevision: 1, withdrawnAt: null, programmeId: null, ownerUserId: null, createdById: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.scopedRecords.push(row);
        return row;
      },
      findUnique: async ({ where }) => state.scopedRecords.find((row) => row.id === where.id) ?? null,
      findMany: async ({ where } = {}) => state.scopedRecords.filter((row) => matchesWhere(row, where)),
      updateMany: async ({ where, data }) => {
        const targets = state.scopedRecords.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data);
        return { count: targets.length };
      },
    },
    recordRevision: {
      create: async ({ data }) => {
        const row = { id: `rev-${state.revisions.length + 1}`, createdAt: new Date(), ...data };
        state.revisions.push(row);
        return row;
      },
      findMany: async ({ where } = {}) => state.revisions.filter((row) => matchesWhere(row, where)),
    },
    objectAuthorization: {
      create: async ({ data }) => {
        const row = { id: `grant-${state.grants.length + 1}`, editionId: null, purpose: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null, ...data };
        state.grants.push(row);
        return row;
      },
      findFirst: async ({ where } = {}) => state.grants.find((row) => matchesWhere(row, where)) ?? null,
      findMany: async ({ where } = {}) => state.grants.filter((row) => matchesWhere(row, where)),
      updateMany: async ({ where, data }) => {
        const targets = state.grants.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data);
        return { count: targets.length };
      },
    },
    programme: { findFirst: async ({ where } = {}) => state.programmes.find((row) => matchesWhere(row, where)) ?? null },
    edition: { findFirst: async () => null },
    accessMembership: { findMany: async ({ where } = {}) => state.memberships.filter((row) => matchesWhere(row, where)) },
    institutionRepresentation: { findFirst: async () => null },
    sourceObjectMapping: { findFirst: async () => null },
    externalDecisionReceipt: {
      create: async ({ data }) => {
        const row = { id: `rcpt-${state.receipts.length + 1}`, programmeId: null, signature: null, contentHash: null, minimalJson: {}, validUntil: null, receivedAt: new Date(), ...data };
        state.receipts.push(row);
        return row;
      },
      findFirst: async ({ where, orderBy } = {}) => applyOrderBy(state.receipts.filter((row) => matchesWhere(row, where)), orderBy)[0] ?? null,
      findUnique: async ({ where } = {}) => state.receipts.find((row) => row.id === where.id || row.idempotencyKey === where.idempotencyKey) ?? null,
    },
    consentRecord: {
      create: async ({ data }) => {
        const row = { id: `consent-${state.consents.length + 1}`, programmeId: null, guardianUserId: null, evidenceJson: null, withdrawnAt: null, validUntil: null, ...data };
        // grantConsent 传 validFrom: undefined（DB 默认 CURRENT_TIMESTAMP），fake 中补过去时间，
        // 否则 resolveConsent 的 validFrom<=now 窗口条件永不成立。
        if (row.validFrom === undefined) row.validFrom = PAST;
        state.consents.push(row);
        return row;
      },
      findUnique: async ({ where } = {}) => state.consents.find((row) => row.id === where.id) ?? null,
      findFirst: async ({ where, orderBy } = {}) => applyOrderBy(state.consents.filter((row) => matchesWhere(row, where)), orderBy)[0] ?? null,
      findMany: async ({ where, orderBy, take } = {}) => applyOrderBy(state.consents.filter((row) => matchesWhere(row, where)), orderBy).slice(0, take ?? 100),
      updateMany: async ({ where, data }) => {
        const targets = state.consents.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data);
        return { count: targets.length };
      },
    },
    channelClient: { findMany: async ({ where } = {}) => state.clients.filter((row) => matchesWhere(row, where)) },
    outboundDispatch: {
      create: async ({ data }) => {
        const row = { id: `d-${state.dispatches.length + 1}`, attempts: 0, status: "PENDING", maxAttempts: 5, ...data };
        state.dispatches.push(row);
        return row;
      },
      findUnique: async ({ where } = {}) => state.dispatches.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
      findMany: async ({ where } = {}) => state.dispatches.filter((row) => matchesWhere(row, where)),
    },
    user: { findUnique: async ({ where }) => state.users.find((row) => row.id === where.id) ?? null },
    coreAuditLog: { create: async ({ data }) => { state.audits.push(data); return data; } },
    $transaction: async (callback) => callback(fake),
  };
  return { fake, state };
}

function seedRecord(state, { id = "rec-1", ownerUserId = "owner-1", programmeId = null } = {}) {
  const row = { id, ownerUserId, programmeId, status: "ACTIVE", currentRevision: 1, createdById: ownerUserId, withdrawnAt: null, createdAt: new Date(), updatedAt: new Date() };
  state.scopedRecords.push(row);
  return row;
}

function publishInput(overrides = {}) {
  return { actorUserId: "owner-1", objectType: "scoped_record", objectId: "rec-1", version: 1, projectionJson: { title: "V1" }, ...overrides };
}

test("发布权限：非所有者且无授权 → 403 RECORD_ACCESS_DENIED，记录不存在也 403", async () => {
  const { fake, state } = makeFake();
  seedRecord(state);

  const denied = await gateway.publishProjection(fake, publishInput({ actorUserId: "outsider-1" }));
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "RECORD_ACCESS_DENIED");
  assert.equal(state.publications.length, 0);

  const missing = await gateway.publishProjection(fake, publishInput({ objectId: "missing" }));
  assert.equal(missing.status, 403);
  assert.equal(missing.code, "RECORD_ACCESS_DENIED");
});

test("发布：version<1 → 400；所有者发 v1 成功且投影与审计同事务落库", async () => {
  const { fake, state } = makeFake();
  seedRecord(state);

  const invalid = await gateway.publishProjection(fake, publishInput({ version: 0 }));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.code, "INVALID_REQUEST");

  const published = await gateway.publishProjection(fake, publishInput());
  assert.equal(published.deduplicated, false);
  assert.equal(typeof published.publicationId, "string");
  const row = state.publications.find((r) => r.id === published.publicationId);
  assert.equal(row.objectType, "scoped_record");
  assert.equal(row.objectId, "rec-1");
  assert.equal(row.version, 1);
  assert.equal(row.status, "PUBLISHED");
  assert.equal(row.publishedById, "owner-1");
  assert.deepEqual(row.projectionJson, { title: "V1" });
  const audit = state.audits.find((a) => a.action === "publication.publish");
  assert.ok(audit);
  assert.equal(audit.metadataJson.version, 1);
  assert.equal(audit.metadataJson.publicationId, published.publicationId);
});

test("发布幂等与冲突：同版本同内容去重，异内容 409，撤回版本禁止复活", async () => {
  const { fake, state } = makeFake();
  seedRecord(state);
  const first = await gateway.publishProjection(fake, publishInput({ projectionJson: { a: 1, b: { c: 2 } } }));
  assert.equal(first.deduplicated, false);

  // 键序不同但内容相同：hashProjectionJson 规范化后视为同一投影。
  const replay = await gateway.publishProjection(fake, publishInput({ projectionJson: { b: { c: 2 }, a: 1 } }));
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.publicationId, first.publicationId);
  assert.equal(state.publications.length, 1, "去重不得新增投影行");
  assert.equal(state.audits.filter((a) => a.action === "publication.publish").length, 1, "去重路径不写审计");

  const conflict = await gateway.publishProjection(fake, publishInput({ projectionJson: { a: 1, b: { c: 3 } } }));
  assert.equal(conflict.status, 409);
  assert.equal(conflict.code, "PUBLICATION_CONFLICT");

  const withdrawn = await gateway.withdrawProjection(fake, { actorUserId: "owner-1", objectType: "scoped_record", objectId: "rec-1", version: 1 });
  assert.equal(withdrawn.publicationId, first.publicationId);
  const restore = await gateway.publishProjection(fake, publishInput({ projectionJson: { a: 1, b: { c: 2 } } }));
  assert.equal(restore.status, 409);
  assert.equal(restore.code, "PUBLICATION_RESTORE_FORBIDDEN");
});

test("发新版不下架旧版：默认读门返回最新版，指定 version 仍返回旧版", async () => {
  const { fake, state } = makeFake();
  seedRecord(state);
  await gateway.publishProjection(fake, publishInput({ version: 1, projectionJson: { title: "V1" } }));
  await gateway.publishProjection(fake, publishInput({ version: 2, projectionJson: { title: "V2" } }));

  const latest = await gateway.readPublishedProjection(fake, { objectType: "scoped_record", objectId: "rec-1" });
  assert.equal(latest.publication.version, 2);
  assert.deepEqual(latest.publication.projectionJson, { title: "V2" });

  const v1 = await gateway.readPublishedProjection(fake, { objectType: "scoped_record", objectId: "rec-1", version: 1 });
  assert.equal(v1.publication.version, 1);
  assert.deepEqual(v1.publication.projectionJson, { title: "V1" });

  const missing = await gateway.readPublishedProjection(fake, { objectType: "scoped_record", objectId: "rec-1", version: 9 });
  assert.equal(missing.publication, null);
  const absent = await gateway.readPublishedProjection(fake, { objectType: "scoped_record", objectId: "missing" });
  assert.equal(absent.publication, null);

  const listed = await gateway.listPublications(fake, { objectType: "scoped_record", objectId: "rec-1" });
  assert.deepEqual(listed.publications.map((row) => row.version), [2, 1], "管理端列表按版本倒序");
  assert.equal(state.publications.length, 2);
});

test("撤回：所有者撤回成功且读门立即失效，重复撤回幂等不再入队", async () => {
  const { fake, state } = makeFake({ clients: [PUB_CLIENT] });
  seedRecord(state);
  const published = await gateway.publishProjection(fake, publishInput());
  assert.equal(state.dispatches.length, 1);

  const withdrawn = await gateway.withdrawProjection(fake, { actorUserId: "owner-1", objectType: "scoped_record", objectId: "rec-1", version: 1 });
  assert.equal(withdrawn.publicationId, published.publicationId);
  const row = state.publications.find((r) => r.id === published.publicationId);
  assert.equal(row.status, "WITHDRAWN");
  assert.equal(row.withdrawnById, "owner-1");
  assert.ok(row.withdrawnAt instanceof Date);

  const readVersioned = await gateway.readPublishedProjection(fake, { objectType: "scoped_record", objectId: "rec-1", version: 1 });
  assert.equal(readVersioned.publication, null, "fail-closed：已撤回版本读门返回 null");
  const readLatest = await gateway.readPublishedProjection(fake, { objectType: "scoped_record", objectId: "rec-1" });
  assert.equal(readLatest.publication, null);

  const again = await gateway.withdrawProjection(fake, { actorUserId: "owner-1", objectType: "scoped_record", objectId: "rec-1", version: 1 });
  assert.equal(again.publicationId, published.publicationId, "重复撤回视为幂等成功");
  assert.equal(state.dispatches.length, 2, "幂等撤回不得再次入队");
  assert.equal(state.audits.filter((a) => a.action === "publication.withdraw").length, 1, "幂等撤回不写审计");
});

test("撤回：非所有者 403，不存在的版本 404", async () => {
  const { fake, state } = makeFake();
  seedRecord(state);
  await gateway.publishProjection(fake, publishInput());

  const denied = await gateway.withdrawProjection(fake, { actorUserId: "outsider-1", objectType: "scoped_record", objectId: "rec-1", version: 1 });
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "RECORD_ACCESS_DENIED");

  const missing = await gateway.withdrawProjection(fake, { actorUserId: "owner-1", objectType: "scoped_record", objectId: "rec-1", version: 9 });
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "PUBLICATION_NOT_FOUND");
});

test("乱序安全：撤回 v1 不影响 v2，读门逐版本隔离", async () => {
  const { fake, state } = makeFake();
  seedRecord(state);
  await gateway.publishProjection(fake, publishInput({ version: 1, projectionJson: { title: "V1" } }));
  await gateway.publishProjection(fake, publishInput({ version: 2, projectionJson: { title: "V2" } }));

  await gateway.withdrawProjection(fake, { actorUserId: "owner-1", objectType: "scoped_record", objectId: "rec-1", version: 1 });
  assert.equal((await gateway.readPublishedProjection(fake, { objectType: "scoped_record", objectId: "rec-1", version: 1 })).publication, null);
  const latest = await gateway.readPublishedProjection(fake, { objectType: "scoped_record", objectId: "rec-1" });
  assert.equal(latest.publication.version, 2, "撤回旧版本不得下架新版本");

  await gateway.withdrawProjection(fake, { actorUserId: "owner-1", objectType: "scoped_record", objectId: "rec-1", version: 2 });
  assert.equal((await gateway.readPublishedProjection(fake, { objectType: "scoped_record", objectId: "rec-1" })).publication, null);
});

test("授权通道：READ 授权不足 403，MANAGE 授权可发布；PROGRAMME_ADMIN 可发布，VIEWER 403", async () => {
  const { fake, state } = makeFake({
    grants: [{ subjectUserId: "outsider-1", objectType: "scoped_record", objectId: "rec-1", action: "READ", programmeId: null }],
  });
  seedRecord(state);
  const denied = await gateway.publishProjection(fake, publishInput({ actorUserId: "outsider-1" }));
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "RECORD_ACCESS_DENIED");

  state.grants.push({ id: "grant-manage", subjectUserId: "viewer-1", objectType: "scoped_record", objectId: "rec-1", action: "MANAGE", programmeId: null, editionId: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null });
  const viaGrant = await gateway.publishProjection(fake, publishInput({ actorUserId: "viewer-1" }));
  assert.equal(viaGrant.deduplicated, false);

  const scoped = makeFake({
    programmes: [{ id: "prog-1" }],
    memberships: [
      { userId: "admin-1", programmeId: "prog-1", role: "PROGRAMME_ADMIN" },
      { userId: "viewer-1", programmeId: "prog-1", role: "PROGRAMME_VIEWER" },
    ],
  });
  seedRecord(scoped.state, { id: "rec-2", programmeId: "prog-1" });
  const viaAdmin = await gateway.publishProjection(scoped.fake, publishInput({ objectId: "rec-2", actorUserId: "admin-1" }));
  assert.equal(viaAdmin.deduplicated, false);
  const viaViewer = await gateway.publishProjection(scoped.fake, publishInput({ objectId: "rec-2", actorUserId: "viewer-1" }));
  assert.equal(viaViewer.status, 403);
  assert.equal(viaViewer.code, "RECORD_ACCESS_DENIED");
});

test("非 scoped_record 对象：仅 Programme manage 可发布，缺 programmeId → 403", async () => {
  const { fake, state } = makeFake({
    programmes: [{ id: "prog-1" }],
    memberships: [{ userId: "admin-1", programmeId: "prog-1", role: "PROGRAMME_ADMIN" }],
  });

  const denied = await gateway.publishProjection(fake, { actorUserId: "outsider-1", objectType: "activity", objectId: "act-1", version: 1, projectionJson: {}, programmeId: "prog-1" });
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "RECORD_ACCESS_DENIED");

  const noScope = await gateway.publishProjection(fake, { actorUserId: "owner-1", objectType: "activity", objectId: "act-1", version: 1, projectionJson: {} });
  assert.equal(noScope.status, 403);
  assert.equal(noScope.code, "RECORD_ACCESS_DENIED");

  const ok = await gateway.publishProjection(fake, { actorUserId: "admin-1", objectType: "activity", objectId: "act-1", version: 1, projectionJson: { name: "A" }, programmeId: "prog-1" });
  assert.equal(ok.deduplicated, false);
  assert.equal(state.publications[0].objectType, "activity");
});

test("同意门：缺失同意 → 403 CONSENT_REQUIRED", async () => {
  const { fake, state } = makeFake();
  seedRecord(state);
  const result = await gateway.publishProjection(fake, publishInput({
    consentRequirements: [{ subjectUserId: "subject-1", purpose: "portrait_use" }],
  }));
  assert.equal(result.status, 403);
  assert.equal(result.code, "CONSENT_REQUIRED");
  assert.equal(state.publications.length, 0);
});

test("同意门：授予后撤回 → 403 CONSENT_WITHDRAWN，授予期间可发布", async () => {
  const { fake, state } = makeFake();
  seedRecord(state);
  const requirements = [{ subjectUserId: "subject-1", purpose: "portrait_use" }];

  const granted = await consents.grantConsent(fake, { grantorUserId: "subject-1", subjectUserId: "subject-1", purpose: "portrait_use" });
  assert.ok(granted.consentId);
  const published = await gateway.publishProjection(fake, publishInput({ consentRequirements: requirements }));
  assert.equal(published.deduplicated, false);

  const withdrawn = await consents.withdrawConsent(fake, { consentId: granted.consentId, actorUserId: "subject-1" });
  assert.equal(withdrawn.consentId, granted.consentId);
  const blocked = await gateway.publishProjection(fake, publishInput({ version: 2, consentRequirements: requirements }));
  assert.equal(blocked.status, 403);
  assert.equal(blocked.code, "CONSENT_WITHDRAWN");
  assert.equal(state.publications.length, 1, "撤回同意后新版本不得发布");
});

test("同意门：频道限定——同意限 fs_public 时其他频道 403，匹配频道成功", async () => {
  const { fake, state } = makeFake();
  seedRecord(state);
  await consents.grantConsent(fake, { grantorUserId: "subject-1", subjectUserId: "subject-1", purpose: "portrait_use", channel: "fs_public" });
  const requirements = [{ subjectUserId: "subject-1", purpose: "portrait_use" }];

  const wrongChannel = await gateway.publishProjection(fake, publishInput({ channel: "other_channel", consentRequirements: requirements }));
  assert.equal(wrongChannel.status, 403);
  assert.equal(wrongChannel.code, "CONSENT_REQUIRED", "频道不匹配视为缺失（非撤回）");

  const matched = await gateway.publishProjection(fake, publishInput({ channel: "fs_public", consentRequirements: requirements }));
  assert.equal(matched.deduplicated, false);
  assert.equal(state.publications.length, 1);
});

test("回执门：无回执 → 403；APPROVED 达标 → 成功；版本不足/REJECTED → 403", async () => {
  const { fake, state } = makeFake();
  seedRecord(state, { id: "rec-r" });
  const input = { approvalReceipt: true };

  const noReceipt = await gateway.publishProjection(fake, publishInput({ objectId: "rec-r", ...input }));
  assert.equal(noReceipt.status, 403);
  assert.equal(noReceipt.code, "RECEIPT_ISSUER_UNVERIFIED");

  state.receipts.push({ id: "rcpt-1", issuerKey: "FSV1AUD", objectType: "scoped_record", objectId: "rec-r", objectRevision: 1, purpose: "publication_approval", decision: "APPROVED", minimalJson: {}, contentHash: "h1", validUntil: null, signature: null, programmeId: null, receivedAt: new Date("2026-09-19T00:00:01Z") });
  const v1 = await gateway.publishProjection(fake, publishInput({ objectId: "rec-r", ...input }));
  assert.equal(v1.deduplicated, false);

  const tooNew = await gateway.publishProjection(fake, publishInput({ objectId: "rec-r", version: 2, ...input }));
  assert.equal(tooNew.status, 403);
  assert.equal(tooNew.code, "RECEIPT_ISSUER_UNVERIFIED", "回执版本低于发布版本不得放行");

  state.receipts.push({ id: "rcpt-2", issuerKey: "FSV1AUD", objectType: "scoped_record", objectId: "rec-r", objectRevision: 2, purpose: "publication_approval", decision: "APPROVED", minimalJson: {}, contentHash: "h2", validUntil: null, signature: null, programmeId: null, receivedAt: new Date("2026-09-19T00:00:02Z") });
  const v2 = await gateway.publishProjection(fake, publishInput({ objectId: "rec-r", version: 2, projectionJson: { title: "V2" }, ...input }));
  assert.equal(v2.deduplicated, false);

  state.receipts.push({ id: "rcpt-3", issuerKey: "FSV1AUD", objectType: "scoped_record", objectId: "rec-r", objectRevision: 3, purpose: "publication_approval", decision: "REJECTED", minimalJson: {}, contentHash: "h3", validUntil: null, signature: null, programmeId: null, receivedAt: new Date("2026-09-19T00:00:03Z") });
  const rejected = await gateway.publishProjection(fake, publishInput({ objectId: "rec-r", version: 3, ...input }));
  assert.equal(rejected.status, 403);
  assert.equal(rejected.code, "RECEIPT_ISSUER_UNVERIFIED", "最新回执为 REJECTED 时整门拒绝");
});

test("dispatch 扇出：发布/撤回各入队，payload 只含定位信息不含正文", async () => {
  const clients = [
    PUB_CLIENT,
    { id: "client-2", key: "FSV1OTHER", isActive: true, type: "MACHINE", callbackUrl: "https://other.example/hook", allowedScopes: ["dispatch:other"] },
    { id: "client-3", key: "FSV1HUMAN", isActive: true, type: "USER_FACING", callbackUrl: "https://human.example/hook", allowedScopes: ["dispatch:publications"] },
    { id: "client-4", key: "FSV1NOURL", isActive: true, type: "MACHINE", callbackUrl: null, allowedScopes: ["dispatch:publications"] },
    { id: "client-5", key: "FSV1OFF", isActive: false, type: "MACHINE", callbackUrl: "https://off.example/hook", allowedScopes: ["dispatch:publications"] },
  ];
  const { fake, state } = makeFake({ clients });
  seedRecord(state);
  const projectionJson = { title: "V1", body: "私密正文" };

  const published = await gateway.publishProjection(fake, publishInput({ projectionJson, channel: "fs_public", license: "CC-BY" }));
  assert.equal(state.dispatches.length, 1, "仅 dispatch:publications 的活跃 MACHINE 客户端入队");
  const pubRow = state.dispatches[0];
  assert.equal(pubRow.channelClientId, "client-1");
  assert.equal(pubRow.eventType, "publication.published");
  assert.equal(pubRow.revision, 1);
  assert.equal(pubRow.idempotencyKey, "publication:scoped_record:rec-1:1:published:client-1");
  assert.equal(pubRow.payloadJson.status, "PUBLISHED");
  assert.equal(pubRow.payloadJson.version, 1);
  assert.equal(pubRow.payloadJson.channel, "fs_public");
  assert.equal(pubRow.payloadJson.license, "CC-BY");
  assert.equal(pubRow.payloadJson.projectionHash, gateway.hashProjectionJson(projectionJson));
  assert.equal(typeof pubRow.payloadJson.publishedAt, "string");
  assert.ok(!("projectionJson" in pubRow.payloadJson), "payload 不得包含 projectionJson 正文");
  assert.deepEqual(Object.keys(pubRow.payloadJson).sort(), ["channel", "license", "objectId", "objectType", "projectionHash", "publishedAt", "status", "version"]);

  const withdrawn = await gateway.withdrawProjection(fake, { actorUserId: "owner-1", objectType: "scoped_record", objectId: "rec-1", version: 1 });
  assert.equal(withdrawn.publicationId, published.publicationId);
  assert.equal(state.dispatches.length, 2);
  const wdRow = state.dispatches[1];
  assert.equal(wdRow.channelClientId, "client-1");
  assert.equal(wdRow.eventType, "publication.withdrawn");
  assert.equal(wdRow.revision, 1);
  assert.equal(wdRow.idempotencyKey, "publication:scoped_record:rec-1:1:withdrawn:client-1");
  assert.equal(wdRow.payloadJson.status, "WITHDRAWN");
  assert.equal(wdRow.payloadJson.version, 1);
  assert.equal(typeof wdRow.payloadJson.withdrawnAt, "string");
  assert.ok(!("projectionJson" in wdRow.payloadJson), "撤回 payload 不得包含 projectionJson 正文");
  assert.ok(!("projectionHash" in wdRow.payloadJson));
  assert.deepEqual(Object.keys(wdRow.payloadJson).sort(), ["objectId", "objectType", "status", "version", "withdrawnAt"]);
});
