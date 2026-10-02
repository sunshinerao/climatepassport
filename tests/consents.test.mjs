/**
 * 源码级测试：多目的同意、监护链接、撤回（CP-TODO-249 / CP-FR-060）
 *
 * 覆盖（vm 沙箱 + 内存 Prisma mock）：
 * - 授予：本人自授成功 version=1；同范围（subject×purpose×channel×object）再次授予
 *   version=2，旧行经事务内 updateMany 置 SUPERSEDED
 * - 监护代授：grantor≠subject 时，无 guardianUserId / guardianUserId≠grantor /
 *   guardianUserId==grantor 但 evidenceJson 为空，均 400 GUARDIAN_LINK_REQUIRED；
 *   附 evidenceJson 成功且行内 guardianUserId/evidenceJson 落库、审计 metadataJson.viaGuardian=true
 * - 有效期窗口：validUntil <= validFrom → 400 INVALID_REQUEST
 * - 撤回：无关账号 403 RECORD_ACCESS_DENIED；本人撤回成功；撤回后 resolveConsent 返回 null；
 *   再次撤回 409 CONSENT_WITHDRAWN；监护人（原授予人）可撤回
 * - 解析：validUntil 过去或 validFrom 未生效均不返回；频道精确匹配
 *   （consent.channel 非空且不同 → 不匹配；consent.channel=null 匹配任意请求频道）；
 *   objectType/objectId 通用同意（null）匹配具体对象、具体同意不匹配其它对象；
 *   purpose 分离（image_use 不覆盖 contact）
 * - 列表：本人可见；非本人非授予人 403；授予人可见（含 purpose/status 过滤）
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadService, matchesWhere } from "./_service-loader.mjs";

const consents = loadService("apps/passport-web/lib/server/consents.ts");

function makeFake({ programmes = [], consents: seedConsents = [] } = {}) {
  const state = {
    consents: seedConsents.map((row) => ({ status: "ACTIVE", version: 1, channel: null, objectType: null, objectId: null, programmeId: null, guardianUserId: null, evidenceJson: null, validFrom: new Date(), validUntil: null, withdrawnAt: null, ...row })),
    programmes: programmes.map((programme) => ({ isActive: true, ...programme })),
    users: [{ id: "subject-1" }, { id: "grantor-1" }, { id: "outsider-1" }],
    audits: [],
  };

  const fake = {
    consentRecord: {
      create: async ({ data }) => {
        const row = {
          id: `consent-${state.consents.length + 1}`,
          subjectUserId: null,
          grantorUserId: null,
          purpose: null,
          status: "ACTIVE",
          version: 1,
          channel: null,
          programmeId: null,
          objectType: null,
          objectId: null,
          guardianUserId: null,
          evidenceJson: null,
          // 模拟 schema 默认 CURRENT_TIMESTAMP：服务对未传 validFrom 自授传 undefined，
          // 由 DB 默认值兜底，fake 在此等价处理。
          validFrom: new Date(),
          validUntil: null,
          withdrawnAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        if (row.validFrom === undefined) row.validFrom = new Date();
        if (row.evidenceJson === undefined) row.evidenceJson = null;
        state.consents.push(row);
        return row;
      },
      findUnique: async ({ where }) => state.consents.find((row) => row.id === where.id) ?? null,
      findFirst: async ({ where }) => state.consents.find((row) => matchesWhere(row, where)) ?? null,
      // orderBy/take 直接忽略，返回匹配集（与本服务断言无关）。
      findMany: async ({ where }) => state.consents.filter((row) => matchesWhere(row, where)),
      updateMany: async ({ where, data }) => {
        const targets = state.consents.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data, { updatedAt: new Date() });
        return { count: targets.length };
      },
    },
    programme: {
      findFirst: async ({ where }) => state.programmes.find((row) => matchesWhere(row, where)) ?? null,
    },
    user: { findUnique: async ({ where }) => state.users.find((row) => row.id === where.id) ?? null },
    coreAuditLog: { create: async ({ data }) => { state.audits.push(data); return data; } },
    $transaction: async (callback) => callback(fake),
  };
  return { fake, state };
}

test("授予：本人自授成功 version=1，同范围再次授予 version=2 且旧行 SUPERSEDED", async () => {
  const { fake, state } = makeFake();
  const input = { grantorUserId: "subject-1", subjectUserId: "subject-1", purpose: "image_use", channel: "email" };

  const first = await consents.grantConsent(fake, input);
  assert.equal(first.consentId, "consent-1");
  assert.equal(first.version, 1);
  const row1 = state.consents[0];
  assert.equal(row1.status, "ACTIVE");
  assert.equal(row1.version, 1);
  assert.equal(row1.grantorUserId, "subject-1");
  assert.equal(row1.guardianUserId, null, "自授不落 guardianUserId");
  assert.equal(row1.evidenceJson, null, "自授不落 evidenceJson");
  assert.ok(row1.validFrom instanceof Date, "未传 validFrom 时由 DB 默认 CURRENT_TIMESTAMP 兜底");

  const second = await consents.grantConsent(fake, input);
  assert.equal(second.version, 2);
  assert.equal(state.consents.length, 2);
  assert.equal(state.consents[0].status, "SUPERSEDED", "同范围旧 ACTIVE 行经事务内 updateMany 置 SUPERSEDED");
  assert.equal(state.consents[0].version, 1);
  assert.equal(state.consents[1].status, "ACTIVE");
  assert.equal(state.consents[1].version, 2);

  const grants = state.audits.filter((a) => a.action === "consent.grant");
  assert.equal(grants.length, 2);
  assert.equal(grants[0].metadataJson.viaGuardian, false);
  assert.equal(grants[0].metadataJson.version, 1);
  assert.equal(grants[1].metadataJson.version, 2);
});

test("授予：监护代授缺少/错配 guardianUserId、缺 evidenceJson 均 400", async () => {
  const { fake, state } = makeFake();
  const base = { grantorUserId: "grantor-1", subjectUserId: "subject-1", purpose: "contact" };

  const noGuardian = await consents.grantConsent(fake, base);
  assert.equal(noGuardian.status, 400);
  assert.equal(noGuardian.code, "GUARDIAN_LINK_REQUIRED");

  const mismatched = await consents.grantConsent(fake, { ...base, guardianUserId: "outsider-1" });
  assert.equal(mismatched.status, 400);
  assert.equal(mismatched.code, "GUARDIAN_LINK_REQUIRED");

  const nullEvidence = await consents.grantConsent(fake, { ...base, guardianUserId: "grantor-1", evidenceJson: null });
  assert.equal(nullEvidence.status, 400);
  assert.equal(nullEvidence.code, "GUARDIAN_LINK_REQUIRED");

  const emptyEvidence = await consents.grantConsent(fake, { ...base, guardianUserId: "grantor-1", evidenceJson: {} });
  assert.equal(emptyEvidence.status, 400);
  assert.equal(emptyEvidence.code, "GUARDIAN_LINK_REQUIRED");

  assert.equal(state.consents.length, 0);
  assert.equal(state.audits.length, 0);
});

test("授予：监护代授附 evidenceJson 成功，行内字段落库且审计 viaGuardian=true", async () => {
  const { fake, state } = makeFake();
  const evidence = { verification: " guardian email + id checked ", ref: "case-42" };
  const granted = await consents.grantConsent(fake, {
    grantorUserId: "grantor-1",
    subjectUserId: "subject-1",
    purpose: "contact",
    guardianUserId: "grantor-1",
    evidenceJson: evidence,
  });
  assert.equal(granted.version, 1);

  const row = state.consents[0];
  assert.equal(row.grantorUserId, "grantor-1");
  assert.equal(row.guardianUserId, "grantor-1", "guardianUserId 落库");
  assert.deepEqual(row.evidenceJson, evidence, "evidenceJson 原样落库");

  const audit = state.audits.find((a) => a.action === "consent.grant");
  assert.ok(audit);
  assert.equal(audit.actorUserId, "grantor-1");
  assert.equal(audit.subjectId, row.id);
  assert.equal(audit.result, "granted");
  assert.equal(audit.metadataJson.viaGuardian, true);
  assert.equal(audit.metadataJson.subjectUserId, "subject-1");
});

test("授予：validUntil 不晚于 validFrom 返回 400 INVALID_REQUEST", async () => {
  const { fake, state } = makeFake();
  const from = new Date("2026-09-19T01:00:00.000Z");
  const before = new Date("2026-09-19T00:00:00.000Z");

  const inverted = await consents.grantConsent(fake, {
    grantorUserId: "subject-1",
    subjectUserId: "subject-1",
    purpose: "image_use",
    validFrom: from,
    validUntil: before,
  });
  assert.equal(inverted.status, 400);
  assert.equal(inverted.code, "INVALID_REQUEST");

  const equal = await consents.grantConsent(fake, {
    grantorUserId: "subject-1",
    subjectUserId: "subject-1",
    purpose: "image_use",
    validFrom: from,
    validUntil: from,
  });
  assert.equal(equal.status, 400);
  assert.equal(equal.code, "INVALID_REQUEST");

  assert.equal(state.consents.length, 0);
  assert.equal(state.audits.length, 0);
});

test("授予：主体或授予人账号不存在返回 404 CONSENT_NOT_FOUND", async () => {
  const { fake, state } = makeFake();

  const missingSubject = await consents.grantConsent(fake, { grantorUserId: "ghost", subjectUserId: "ghost", purpose: "image_use" });
  assert.equal(missingSubject.status, 404);
  assert.equal(missingSubject.code, "CONSENT_NOT_FOUND");

  const missingGrantor = await consents.grantConsent(fake, {
    grantorUserId: "ghost",
    subjectUserId: "subject-1",
    purpose: "image_use",
    guardianUserId: "ghost",
    evidenceJson: { ref: "case-42" },
  });
  assert.equal(missingGrantor.status, 404);
  assert.equal(missingGrantor.code, "CONSENT_NOT_FOUND");

  assert.equal(state.consents.length, 0);
});

test("撤回：无关账号 403，本人撤回成功且解析为 null，再次撤回 409", async () => {
  const { fake, state } = makeFake();
  const granted = await consents.grantConsent(fake, { grantorUserId: "subject-1", subjectUserId: "subject-1", purpose: "image_use" });
  assert.equal(granted.version, 1);

  const outsider = await consents.withdrawConsent(fake, { consentId: granted.consentId, actorUserId: "outsider-1" });
  assert.equal(outsider.status, 403);
  assert.equal(outsider.code, "RECORD_ACCESS_DENIED");
  assert.equal(state.consents[0].status, "ACTIVE", "403 不改变状态");

  const withdrawn = await consents.withdrawConsent(fake, { consentId: granted.consentId, actorUserId: "subject-1" });
  assert.equal(withdrawn.consentId, granted.consentId);
  assert.equal(state.consents[0].status, "WITHDRAWN");
  assert.ok(state.consents[0].withdrawnAt instanceof Date);

  const resolved = await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "image_use" });
  assert.equal(resolved.consent, null, "撤回后 resolveConsent 返回 null");

  const again = await consents.withdrawConsent(fake, { consentId: granted.consentId, actorUserId: "subject-1" });
  assert.equal(again.status, 409);
  assert.equal(again.code, "CONSENT_WITHDRAWN");

  assert.equal(state.audits.filter((a) => a.action === "consent.withdraw").length, 1, "仅成功撤回写审计");
});

test("撤回：监护人（原授予人）可撤回", async () => {
  const { fake, state } = makeFake();
  const granted = await consents.grantConsent(fake, {
    grantorUserId: "grantor-1",
    subjectUserId: "subject-1",
    purpose: "contact",
    guardianUserId: "grantor-1",
    evidenceJson: { ref: "case-42" },
  });

  const byGuardian = await consents.withdrawConsent(fake, { consentId: granted.consentId, actorUserId: "grantor-1" });
  assert.equal(byGuardian.consentId, granted.consentId);
  assert.equal(state.consents[0].status, "WITHDRAWN");

  const audit = state.audits.find((a) => a.action === "consent.withdraw");
  assert.equal(audit.actorUserId, "grantor-1");
  assert.equal(audit.metadataJson.subjectUserId, "subject-1");
});

test("解析：validUntil 过去或 validFrom 未生效均不返回", async () => {
  const { fake } = makeFake();
  const at = new Date("2026-09-19T00:00:00.000Z");

  const expired = await consents.grantConsent(fake, {
    grantorUserId: "subject-1",
    subjectUserId: "subject-1",
    purpose: "image_use",
    validUntil: new Date(at.getTime() - 1_000),
  });
  assert.equal(expired.version, 1, "仅 validUntil 过去不阻断授予本身");
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "image_use", at })).consent, null);

  const future = await consents.grantConsent(fake, {
    grantorUserId: "subject-1",
    subjectUserId: "subject-1",
    purpose: "contact",
    validFrom: new Date(at.getTime() + 3_600_000),
    validUntil: new Date(at.getTime() + 7_200_000),
  });
  assert.equal(future.version, 1);
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "contact", at })).consent, null, "validFrom 未生效不返回");
  const inside = await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "contact", at: new Date(at.getTime() + 5_400_000) });
  assert.equal(inside.consent.id, future.consentId, "窗口内返回有效同意");
});

test("解析：频道精确匹配，consent.channel 为空匹配任意请求频道", async () => {
  const { fake, state } = makeFake();

  const specific = await consents.grantConsent(fake, { grantorUserId: "subject-1", subjectUserId: "subject-1", purpose: "image_use", channel: "EMAIL" });
  assert.equal(state.consents[0].channel, "email", "channel 存储时规范化（小写）");
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "image_use", channel: "email" })).consent.id, specific.consentId);
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "image_use", channel: " Email " })).consent.id, specific.consentId, "请求频道规范化后精确匹配");
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "image_use", channel: "social" })).consent, null, "consent.channel 非空且不同 → 不匹配");
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "image_use" })).consent, null, "请求频道为空而同意限定频道 → 不匹配");

  const generic = await consents.grantConsent(fake, { grantorUserId: "grantor-1", subjectUserId: "grantor-1", purpose: "image_use" });
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "grantor-1", purpose: "image_use", channel: "sms" })).consent.id, generic.consentId, "consent.channel=null 匹配任意请求频道");
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "grantor-1", purpose: "image_use" })).consent.id, generic.consentId);
});

test("解析：通用同意匹配具体对象，具体同意不匹配其它对象", async () => {
  const { fake } = makeFake();

  const generic = await consents.grantConsent(fake, { grantorUserId: "subject-1", subjectUserId: "subject-1", purpose: "image_use" });
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "image_use", objectType: "image", objectId: "img-1" })).consent.id, generic.consentId, "objectType/objectId 为 null 的通用同意匹配具体对象");

  const specific = await consents.grantConsent(fake, { grantorUserId: "grantor-1", subjectUserId: "grantor-1", purpose: "image_use", objectType: "image", objectId: "img-1" });
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "grantor-1", purpose: "image_use", objectType: "image", objectId: "img-1" })).consent.id, specific.consentId);
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "grantor-1", purpose: "image_use", objectType: "image", objectId: "img-2" })).consent, null, "具体同意不匹配其它对象");
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "grantor-1", purpose: "image_use" })).consent, null, "具体同意不覆盖通用（无对象）请求");
});

test("解析：purpose 分离，image_use 同意不覆盖 contact", async () => {
  const { fake } = makeFake();
  const granted = await consents.grantConsent(fake, { grantorUserId: "subject-1", subjectUserId: "subject-1", purpose: "image_use" });

  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "contact" })).consent, null, "image_use 同意不授权 contact 目的");
  assert.equal((await consents.resolveConsent(fake, { subjectUserId: "subject-1", purpose: "image_use" })).consent.id, granted.consentId);
});

test("列表：本人可见，非本人非授予人 403，授予人可见（含 purpose/status 过滤）", async () => {
  const { fake } = makeFake();
  await consents.grantConsent(fake, { grantorUserId: "subject-1", subjectUserId: "subject-1", purpose: "image_use" });
  await consents.grantConsent(fake, {
    grantorUserId: "grantor-1",
    subjectUserId: "subject-1",
    purpose: "contact",
    guardianUserId: "grantor-1",
    evidenceJson: { ref: "case-42" },
  });

  const denied = await consents.listConsentsForSubject(fake, { subjectUserId: "subject-1", actorUserId: "outsider-1" });
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "RECORD_ACCESS_DENIED");

  const own = await consents.listConsentsForSubject(fake, { subjectUserId: "subject-1", actorUserId: "subject-1" });
  assert.equal(own.consents.length, 2, "本人可见全部目的");

  const byGrantor = await consents.listConsentsForSubject(fake, { subjectUserId: "subject-1", actorUserId: "grantor-1" });
  assert.equal(byGrantor.consents.length, 2, "授予人（监护人）可见");

  const filtered = await consents.listConsentsForSubject(fake, { subjectUserId: "subject-1", actorUserId: "subject-1", purpose: "image_use", status: "ACTIVE" });
  assert.equal(filtered.consents.length, 1);
  assert.equal(filtered.consents[0].purpose, "image_use");

  const withdrawnOnly = await consents.listConsentsForSubject(fake, { subjectUserId: "subject-1", actorUserId: "subject-1", status: "WITHDRAWN" });
  assert.equal(withdrawnOnly.consents.length, 0, "status 过滤生效");
});
