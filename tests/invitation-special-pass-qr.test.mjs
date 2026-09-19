import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function createNextResponseMock() {
  return {
    json(payload, init) {
      return {
        status: init?.status ?? 200,
        payload,
      };
    },
  };
}

function loadModule(sourcePath, moduleMocks) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (moduleName) => {
      if (Object.prototype.hasOwnProperty.call(moduleMocks, moduleName)) {
        return moduleMocks[moduleName];
      }
      if (moduleName === "@/lib/server/rate-limit") {
        return {
          checkRateLimitAsync: async () => ({ allowed: true, remaining: 1, resetAt: Date.now() + 60_000 }),
          getRequestRateLimitKey: () => "test",
        };
      }
      return require(moduleName);
    },
    URL,
    Request,
    Response,
    Date,
    console,
    setTimeout,
    clearTimeout,
    encodeURIComponent,
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

// ─────────────────────────────────────────────────────────────────────────────
// Issuer helper tests
// ─────────────────────────────────────────────────────────────────────────────

test("issueInvitationSpecialPassQr revokes prior active token and issues a new one", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/invitation-special-pass-qr.ts");

  let issuedToken = null;
  let revokedTokenIds = [];
  let auditCalls = [];

  const prisma = {
    event: {
      findUnique: async () => ({ id: "event-1", endDate: new Date(Date.now() + 1000 * 60 * 60 * 24) }),
      findFirst: async () => ({ id: "event-1" }),
    },
    invitationRequest: {
      findUnique: async () => ({
        id: "inv-1",
        userId: "user-1",
        eventId: "event-1",
        status: "APPROVED",
        guestName: "Guest One",
      }),
    },
    specialPass: {
      findUnique: async () => null,
    },
    qrToken: {
      findMany: async ({ where }) => {
        if (where.status === "ACTIVE") {
          return [{ id: "old-token-1" }];
        }
        return [{ id: "old-token-1" }];
      },
      updateMany: async ({ where, data }) => {
        revokedTokenIds = where.id?.in ?? [];
        return { count: revokedTokenIds.length };
      },
    },
  };

  const module = loadModule(sourcePath, {
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/qr": {
      getInvitationSpecialPassQrExpiry: () => new Date(Date.now() + 1000 * 60 * 60),
      issueQrToken: async (input) => {
        issuedToken = input;
        return { token: "raw-token-new", tokenId: "new-token-1", type: "INVITATION_SPECIAL_PASS", expiresAt: new Date(Date.now() + 1000 * 60 * 60) };
      },
    },
    "@/lib/server/audit": {
      writeCoreAuditLog: async (input) => {
        auditCalls.push(input);
      },
    },
  });

  const result = await module.issueInvitationSpecialPassQr({
    actor: { id: "admin-1", role: "ADMIN" },
    subjectType: "invitation_request",
    subjectId: "inv-1",
  });

  assert.equal(result.token, "raw-token-new");
  assert.deepEqual(revokedTokenIds, ["old-token-1"]);
  assert.equal(issuedToken.type, "INVITATION_SPECIAL_PASS");
  assert.equal(issuedToken.subjectType, "invitation_request");
  assert.equal(issuedToken.subjectId, "inv-1");
  assert.equal(issuedToken.eventId, "event-1");
  assert.equal(auditCalls.some((call) => call.action === "invitation_special_pass_qr.revoke_prior"), true);
  assert.equal(auditCalls.some((call) => call.action === "invitation_special_pass_qr.issue"), true);
});

test("reissue queries by raw subject ID while audit entries remain opaque", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/invitation-special-pass-qr.ts");
  const raw = {
    subjectId: "subject-internal-123",
    eventId: "event-internal-456",
    priorTokenId: "prior-token-internal-789",
    tokenId: "new-token-internal-012",
  };
  let priorLookupWhere;
  let revokedWhere;
  const auditCalls = [];
  const prisma = {
    event: {
      findUnique: async () => ({ id: raw.eventId, endDate: new Date(Date.now() + 60_000) }),
      findFirst: async () => ({ id: raw.eventId }),
    },
    invitationRequest: {
      findUnique: async () => ({ id: raw.subjectId, userId: "user-internal", eventId: raw.eventId, status: "APPROVED", guestName: "Guest" }),
    },
    specialPass: { findUnique: async () => null },
    qrToken: {
      findMany: async ({ where }) => {
        if (where.status === "ACTIVE") {
          priorLookupWhere = where;
        }
        return [{ id: raw.priorTokenId }];
      },
      updateMany: async ({ where }) => {
        revokedWhere = where;
        return { count: 1 };
      },
    },
  };
  const module = loadModule(sourcePath, {
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/qr": { getInvitationSpecialPassQrExpiry: () => new Date(Date.now() + 60_000), issueQrToken: async () => ({ token: "raw-qr-token", tokenId: raw.tokenId, expiresAt: new Date(Date.now() + 60_000) }) },
    "@/lib/server/audit": { writeCoreAuditLog: async (input) => auditCalls.push(input) },
  });

  await module.issueInvitationSpecialPassQr({ actor: { id: "admin-1", role: "ADMIN" }, subjectType: "invitation_request", subjectId: raw.subjectId });

  assert.equal(priorLookupWhere.subjectId, raw.subjectId);
  assert.deepEqual(revokedWhere.id.in, [raw.priorTokenId]);
  for (const call of auditCalls) {
    const serialized = JSON.stringify({ subjectId: call.subjectId, metadataJson: call.metadataJson });
    for (const value of Object.values(raw)) assert.equal(serialized.includes(value), false);
  }
});

test("issueInvitationSpecialPassQr rejects non-approved invitation", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/invitation-special-pass-qr.ts");

  const prisma = {
    event: {
      findUnique: async () => ({ id: "event-1", endDate: new Date() }),
      findFirst: async () => ({ id: "event-1" }),
    },
    invitationRequest: {
      findUnique: async () => ({
        id: "inv-1",
        userId: "user-1",
        eventId: "event-1",
        status: "PENDING",
        guestName: "Guest One",
      }),
    },
    specialPass: { findUnique: async () => null },
    qrToken: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
  };

  const module = loadModule(sourcePath, {
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/qr": {
      getInvitationSpecialPassQrExpiry: () => new Date(),
      issueQrToken: async () => {
        throw new Error("should not issue");
      },
    },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  await assert.rejects(
    () =>
      module.issueInvitationSpecialPassQr({
        actor: { id: "admin-1", role: "ADMIN" },
        subjectType: "invitation_request",
        subjectId: "inv-1",
      }),
    /not approved/,
  );
});

test("issueInvitationSpecialPassQr rejects event manager issuing for non-managed event", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/invitation-special-pass-qr.ts");

  const prisma = {
    event: {
      findUnique: async () => ({ id: "event-1", endDate: new Date() }),
      findFirst: async () => null,
    },
    invitationRequest: {
      findUnique: async () => ({
        id: "inv-1",
        userId: "user-1",
        eventId: "event-1",
        status: "APPROVED",
        guestName: "Guest One",
      }),
    },
    specialPass: { findUnique: async () => null },
    qrToken: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
  };

  const module = loadModule(sourcePath, {
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/qr": {
      getInvitationSpecialPassQrExpiry: () => new Date(),
      issueQrToken: async () => {
        throw new Error("should not issue");
      },
    },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  await assert.rejects(
    () =>
      module.issueInvitationSpecialPassQr({
        actor: { id: "manager-1", role: "EVENT_MANAGER" },
        subjectType: "invitation_request",
        subjectId: "inv-1",
      }),
    /Insufficient permissions/,
  );
});

test("issueInvitationSpecialPassQr rejects unbound special pass", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/invitation-special-pass-qr.ts");

  const prisma = {
    event: {
      findUnique: async () => null,
      findFirst: async () => null,
    },
    invitationRequest: { findUnique: async () => null },
    specialPass: {
      findUnique: async () => ({
        id: "sp-1",
        userId: "user-1",
        eventId: null,
        status: "APPROVED",
        name: "Pass Holder",
      }),
    },
    qrToken: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
  };

  const module = loadModule(sourcePath, {
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/qr": {
      getInvitationSpecialPassQrExpiry: () => new Date(),
      issueQrToken: async () => {
        throw new Error("should not issue");
      },
    },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  await assert.rejects(
    () =>
      module.issueInvitationSpecialPassQr({
        actor: { id: "admin-1", role: "ADMIN" },
        subjectType: "special_pass",
        subjectId: "sp-1",
      }),
    /not bound/,
  );
});

test("issueInvitationSpecialPassQr rejects an ended event before issuing a token", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/invitation-special-pass-qr.ts");
  let issueCalls = 0;
  const prisma = {
    event: { findUnique: async () => ({ id: "event-1", endDate: new Date(Date.now() - 60_000) }), findFirst: async () => ({ id: "event-1" }) },
    invitationRequest: { findUnique: async () => ({ id: "inv-1", userId: "user-1", eventId: "event-1", status: "APPROVED", guestName: "Guest" }) },
    specialPass: { findUnique: async () => null },
    qrToken: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
  };
  const module = loadModule(sourcePath, {
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/qr": { getInvitationSpecialPassQrExpiry: (event) => event.endDate, issueQrToken: async () => { issueCalls += 1; } },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  await assert.rejects(
    () => module.issueInvitationSpecialPassQr({ actor: { id: "admin-1", role: "ADMIN" }, subjectType: "invitation_request", subjectId: "inv-1" }),
    /event has ended/,
  );
  assert.equal(issueCalls, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Verifier helper tests
// ─────────────────────────────────────────────────────────────────────────────

function createScanPrisma(overrides = {}) {
  const base = {
    event: {
      findFirst: async () => ({ id: "event-1" }),
    },
    eventVerifier: {
      findUnique: async () => ({ id: "assignment-1" }),
    },
    invitationRequest: {
      findUnique: async () => ({
        id: "inv-1",
        status: "APPROVED",
        eventId: "event-1",
        guestName: "Guest One",
      }),
    },
    specialPass: {
      findUnique: async () => null,
    },
    qrToken: {
      findUnique: async () => null,
      update: async () => null,
      updateMany: async () => ({ count: 1 }),
    },
  };
  return { ...base, ...overrides };
}

test("scanInvitationSpecialPassQr returns admitted for valid invitation token", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");

  const prisma = createScanPrisma({
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "ACTIVE",
        eventId: "event-1",
        subjectType: "invitation_request",
        subjectId: "inv-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
        consumedAt: null,
        event: { id: "event-1", title: "Event Title", titleEn: "Event Title EN" },
      }),
      update: async () => null,
      updateMany: async () => ({ count: 1 }),
    },
  });

  const auditCalls = [];
  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": {
      writeCoreAuditLog: async (input) => {
        auditCalls.push(input);
      },
    },
  });

  const result = await module.scanInvitationSpecialPassQr({
    token: "token-1",
    eventId: "event-1",
    verifier: { id: "verifier-1", role: "VERIFIER" },
  });

  assert.equal(result.result, "admitted");
  assert.equal(result.credentialKind, "invitation");
  assert.equal(result.event.title, "Event Title");
  assert.equal(result.holderName, "Guest One");
  assert.equal(auditCalls.some((call) => call.result === "admitted"), true);
});

test("scanInvitationSpecialPassQr returns already_used for consumed token", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");

  const prisma = createScanPrisma({
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "CONSUMED",
        eventId: "event-1",
        subjectType: "invitation_request",
        subjectId: "inv-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
        consumedAt: new Date(),
        event: { id: "event-1", title: "Event Title", titleEn: null },
      }),
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  });

  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  const result = await module.scanInvitationSpecialPassQr({
    token: "token-1",
    eventId: "event-1",
    verifier: { id: "verifier-1", role: "VERIFIER" },
  });

  assert.equal(result.result, "already_used");
});

test("scanInvitationSpecialPassQr returns expired for persisted expired token with opaque audit references", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");
  const raw = { tokenId: "token-internal-123", eventId: "event-internal-456", subjectId: "subject-internal-789" };
  const auditCalls = [];
  const prisma = createScanPrisma({
    qrToken: {
      findUnique: async () => ({ id: raw.tokenId, type: "INVITATION_SPECIAL_PASS", status: "EXPIRED", eventId: raw.eventId, subjectType: "invitation_request", subjectId: raw.subjectId, expiresAt: new Date(), event: null }),
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  });
  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": { hashOpaqueToken: () => "hashed" },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async (input) => auditCalls.push(input) },
  });
  const result = await module.scanInvitationSpecialPassQr({ token: "raw-qr-token", eventId: raw.eventId, verifier: { id: "verifier-1", role: "VERIFIER" } });

  assert.equal(result.result, "expired");
  assert.equal(auditCalls[0].result, "expired");
  const serialized = JSON.stringify({ subjectId: auditCalls[0].subjectId, metadataJson: auditCalls[0].metadataJson });
  for (const value of Object.values(raw)) assert.equal(serialized.includes(value), false);
});

test("pass audit records use opaque references rather than raw identifiers", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");
  const raw = { tokenId: "token-internal-123", eventId: "event-internal-456", subjectId: "subject-internal-789" };
  const auditCalls = [];
  const prisma = createScanPrisma({
    qrToken: {
      findUnique: async () => ({
        id: raw.tokenId,
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "CONSUMED",
        eventId: raw.eventId,
        subjectType: "invitation_request",
        subjectId: raw.subjectId,
        expiresAt: null,
        consumedAt: new Date(),
        event: null,
      }),
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  });
  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": { hashOpaqueToken: () => "hashed" },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async (input) => auditCalls.push(input) },
  });

  await module.scanInvitationSpecialPassQr({ token: "raw-qr-token", eventId: raw.eventId, verifier: { id: "verifier-1", role: "VERIFIER" } });

  assert.equal(auditCalls.length, 1);
  const serialized = JSON.stringify({ subjectId: auditCalls[0].subjectId, metadataJson: auditCalls[0].metadataJson });
  for (const value of Object.values(raw)) assert.equal(serialized.includes(value), false);
  assert.match(auditCalls[0].subjectId, /^sha256:[a-f0-9]{16}$/);
  assert.match(auditCalls[0].metadataJson.tokenRef, /^sha256:[a-f0-9]{16}$/);
  assert.match(auditCalls[0].metadataJson.eventRef, /^sha256:[a-f0-9]{16}$/);
});

test("issuer audit records use opaque references rather than raw identifiers", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/invitation-special-pass-qr.ts");
  const raw = { tokenId: "token-internal-123", oldTokenId: "old-token-internal-456", eventId: "event-internal-789", subjectId: "subject-internal-012" };
  const auditCalls = [];
  const prisma = {
    event: { findUnique: async () => ({ id: raw.eventId, endDate: new Date(Date.now() + 60_000) }), findFirst: async () => ({ id: raw.eventId }) },
    invitationRequest: { findUnique: async () => ({ id: raw.subjectId, userId: "user-internal-123", eventId: raw.eventId, status: "APPROVED", guestName: "Private Guest" }) },
    specialPass: { findUnique: async () => null },
    qrToken: { findMany: async () => [{ id: raw.oldTokenId }], updateMany: async () => ({ count: 1 }) },
  };
  const module = loadModule(sourcePath, {
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/qr": { getInvitationSpecialPassQrExpiry: () => new Date(Date.now() + 60_000), issueQrToken: async () => ({ token: "raw-qr-token", tokenId: raw.tokenId, expiresAt: new Date(Date.now() + 60_000) }) },
    "@/lib/server/audit": { writeCoreAuditLog: async (input) => auditCalls.push(input) },
  });

  await module.issueInvitationSpecialPassQr({ actor: { id: "admin-1", role: "ADMIN" }, subjectType: "invitation_request", subjectId: raw.subjectId });

  for (const call of auditCalls) {
    const serialized = JSON.stringify({ subjectId: call.subjectId, metadataJson: call.metadataJson });
    for (const value of Object.values(raw)) assert.equal(serialized.includes(value), false);
    assert.match(call.subjectId, /^sha256:[a-f0-9]{16}$/);
  }
});

test("scanInvitationSpecialPassQr returns expired for past expiry and marks token expired", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");

  let expiredTokenId = null;
  const prisma = createScanPrisma({
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "ACTIVE",
        eventId: "event-1",
        subjectType: "invitation_request",
        subjectId: "inv-1",
        expiresAt: new Date(Date.now() - 1000 * 60),
        consumedAt: null,
        event: { id: "event-1", title: "Event Title", titleEn: null },
      }),
      update: async ({ where }) => {
        expiredTokenId = where.id;
        return null;
      },
      updateMany: async () => ({ count: 0 }),
    },
  });

  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  const result = await module.scanInvitationSpecialPassQr({
    token: "token-1",
    eventId: "event-1",
    verifier: { id: "verifier-1", role: "VERIFIER" },
  });

  assert.equal(result.result, "expired");
  assert.equal(expiredTokenId, "token-1");
});

test("scanInvitationSpecialPassQr returns wrong_event when eventId mismatches", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");

  const prisma = createScanPrisma({
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "ACTIVE",
        eventId: "event-1",
        subjectType: "invitation_request",
        subjectId: "inv-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
        consumedAt: null,
        event: { id: "event-1", title: "Event Title", titleEn: null },
      }),
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  });

  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  const result = await module.scanInvitationSpecialPassQr({
    token: "token-1",
    eventId: "event-2",
    verifier: { id: "verifier-1", role: "VERIFIER" },
  });

  assert.equal(result.result, "wrong_event");
});

test("scanInvitationSpecialPassQr returns unsupported_context when eventId omitted", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");

  const prisma = createScanPrisma({
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "ACTIVE",
        eventId: "event-1",
        subjectType: "invitation_request",
        subjectId: "inv-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
        consumedAt: null,
        event: { id: "event-1", title: "Event Title", titleEn: null },
      }),
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  });

  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  const result = await module.scanInvitationSpecialPassQr({
    token: "token-1",
    verifier: { id: "verifier-1", role: "VERIFIER" },
  });

  assert.equal(result.result, "unsupported_context");
});

test("scanInvitationSpecialPassQr returns permission_denied for unauthorized verifier", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");

  const prisma = createScanPrisma({
    event: { findFirst: async () => null },
    eventVerifier: { findUnique: async () => null },
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "ACTIVE",
        eventId: "event-1",
        subjectType: "invitation_request",
        subjectId: "inv-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
        consumedAt: null,
        event: { id: "event-1", title: "Event Title", titleEn: null },
      }),
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  });

  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  const result = await module.scanInvitationSpecialPassQr({
    token: "token-1",
    eventId: "event-1",
    verifier: { id: "verifier-2", role: "VERIFIER" },
  });

  assert.equal(result.result, "permission_denied");
});

test("scanInvitationSpecialPassQr returns not_approved for non-approved subject", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");

  const prisma = createScanPrisma({
    invitationRequest: {
      findUnique: async () => ({
        id: "inv-1",
        status: "PENDING",
        eventId: "event-1",
        guestName: "Guest One",
      }),
    },
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "ACTIVE",
        eventId: "event-1",
        subjectType: "invitation_request",
        subjectId: "inv-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
        consumedAt: null,
        event: { id: "event-1", title: "Event Title", titleEn: null },
      }),
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  });

  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  const result = await module.scanInvitationSpecialPassQr({
    token: "token-1",
    eventId: "event-1",
    verifier: { id: "verifier-1", role: "VERIFIER" },
  });

  assert.equal(result.result, "not_approved");
});

test("scanInvitationSpecialPassQr refuses concurrent consumption race", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");

  const prisma = createScanPrisma({
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "ACTIVE",
        eventId: "event-1",
        subjectType: "invitation_request",
        subjectId: "inv-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
        consumedAt: null,
        event: { id: "event-1", title: "Event Title", titleEn: null },
      }),
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  });

  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  const result = await module.scanInvitationSpecialPassQr({
    token: "token-1",
    eventId: "event-1",
    verifier: { id: "verifier-1", role: "VERIFIER" },
  });

  assert.equal(result.result, "already_used");
});

test("scanInvitationSpecialPassQr response excludes PII beyond display-safe holder name", async () => {
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-invitation-special-pass.ts");

  const prisma = createScanPrisma({
    specialPass: {
      findUnique: async () => ({
        id: "sp-1",
        status: "APPROVED",
        eventId: "event-1",
        name: "Pass Holder",
      }),
    },
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed",
        type: "INVITATION_SPECIAL_PASS",
        status: "ACTIVE",
        eventId: "event-1",
        subjectType: "special_pass",
        subjectId: "sp-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
        consumedAt: null,
        event: { id: "event-1", title: "Event Title", titleEn: "Event Title EN" },
      }),
      update: async () => null,
      updateMany: async () => ({ count: 1 }),
    },
  });

  const module = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/audit": { writeCoreAuditLog: async () => null },
  });

  const result = await module.scanInvitationSpecialPassQr({
    token: "token-1",
    eventId: "event-1",
    verifier: { id: "verifier-1", role: "VERIFIER" },
  });

  assert.equal(result.result, "admitted");
  assert.equal(result.credentialKind, "special_pass");
  assert.equal(result.holderName, "Pass Holder");
  assert.equal("email" in result, false);
  assert.equal("phone" in result, false);
  assert.equal("docNumber" in result, false);
  assert.equal("userId" in result, false);
  assert.equal("subjectId" in result, false);
  assert.equal("eventId" in result, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Route authorization tests
// ─────────────────────────────────────────────────────────────────────────────

test("admin invitation QR issue route returns 403 for verifier", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/invitations/[id]/qr/route.ts");

  const route = loadModule(sourcePath, {
    "next/server": { NextResponse: createNextResponseMock() },
    "@/lib/server/auth": {
      getCurrentUser: async () => ({ id: "verifier-1", name: "Verifier", role: "VERIFIER" }),
    },
    "@/lib/server/prisma": { getPrismaClient: () => ({}) },
    "@/lib/server/audit": { getRequestAuditContext: () => ({}) },
    "@/lib/server/invitation-special-pass-qr": {
      issueInvitationSpecialPassQr: async () => {
        throw new Error("should not be called");
      },
    },
  });

  const request = new Request("https://passport.example/api/admin/invitations/inv-1/qr", {
    method: "POST",
  });

  const response = await route.POST(request, { params: { id: "inv-1" } });

  assert.equal(response.status, 403);
  assert.equal(response.payload.error, "Insufficient permissions.");
});

test("issuer QR routes return the one-time token but no internal identifiers", async () => {
  for (const [pathSuffix, subjectType, kind] of [["invitations", "invitation_request", "invitation"], ["special-passes", "special_pass", "special_pass"]]) {
    const sourcePath = path.resolve(`apps/passport-web/app/api/admin/${pathSuffix}/[id]/qr/route.ts`);
    const raw = { tokenId: "token-internal-123", revokedId: "token-internal-456", subjectId: "subject-internal-789" };
    let helperInput;
    const route = loadModule(sourcePath, {
      "next/server": { NextResponse: createNextResponseMock() },
      "@/lib/server/auth": { getCurrentUser: async () => ({ id: "admin-1", role: "ADMIN" }) },
      "@/lib/server/prisma": { getPrismaClient: () => ({}) },
      "@/lib/server/audit": { getRequestAuditContext: () => ({}) },
      "@/lib/server/invitation-special-pass-qr": {
        issueInvitationSpecialPassQr: async (input) => {
          helperInput = input;
          return { ok: true, token: "one-time-qr-token", tokenId: raw.tokenId, expiresAt: new Date("2026-10-01T00:00:00.000Z"), revokedPreviousTokenIds: [raw.revokedId] };
        },
      },
    });
    const response = await route.POST(new Request("https://passport.example/qr", { method: "POST" }), { params: { id: raw.subjectId } });
    assert.equal(helperInput.subjectType, subjectType);
    assert.equal(response.status, 200);
    assert.equal(response.payload.qr.token, "one-time-qr-token");
    assert.equal(response.payload.qr.kind, kind);
    assert.equal(response.payload.revokedPreviousTokenCount, 1);
    const serialized = JSON.stringify(response.payload);
    for (const value of Object.values(raw)) assert.equal(serialized.includes(value), false);
  }
});

test("admin special pass QR revoke route returns 401 when unauthenticated", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/special-passes/[id]/qr/revoke/route.ts");

  const route = loadModule(sourcePath, {
    "next/server": { NextResponse: createNextResponseMock() },
    "@/lib/server/auth": {
      getCurrentUser: async () => null,
    },
    "@/lib/server/prisma": { getPrismaClient: () => ({}) },
    "@/lib/server/audit": { getRequestAuditContext: () => ({}) },
    "@/lib/server/invitation-special-pass-qr": {
      revokeInvitationSpecialPassQr: async () => {
        throw new Error("should not be called");
      },
    },
  });

  const request = new Request("https://passport.example/api/admin/special-passes/sp-1/qr/revoke", {
    method: "POST",
  });

  const response = await route.POST(request, { params: { id: "sp-1" } });

  assert.equal(response.status, 401);
});

test("invitation QR revoke route returns 403 for verifier", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/admin/invitations/[id]/qr/revoke/route.ts");
  const route = loadModule(sourcePath, {
    "next/server": { NextResponse: createNextResponseMock() },
    "@/lib/server/auth": { getCurrentUser: async () => ({ id: "verifier-1", role: "VERIFIER" }) },
    "@/lib/server/prisma": { getPrismaClient: () => ({}) },
    "@/lib/server/audit": { getRequestAuditContext: () => ({}) },
    "@/lib/server/invitation-special-pass-qr": { revokeInvitationSpecialPassQr: async () => { throw new Error("should not be called"); } },
  });
  const response = await route.POST(new Request("https://passport.example/qr/revoke", { method: "POST" }), { params: { id: "inv-1" } });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error, "Insufficient permissions.");
});

test("revoke QR routes return only a safe count", async () => {
  for (const [pathSuffix, subjectType] of [["invitations", "invitation_request"], ["special-passes", "special_pass"]]) {
    const sourcePath = path.resolve(`apps/passport-web/app/api/admin/${pathSuffix}/[id]/qr/revoke/route.ts`);
    const raw = { subjectId: "subject-internal-123", tokenId: "token-internal-456" };
    let helperInput;
    const route = loadModule(sourcePath, {
      "next/server": { NextResponse: createNextResponseMock() },
      "@/lib/server/auth": { getCurrentUser: async () => ({ id: "admin-1", role: "ADMIN" }) },
      "@/lib/server/prisma": { getPrismaClient: () => ({}) },
      "@/lib/server/audit": { getRequestAuditContext: () => ({}) },
      "@/lib/server/invitation-special-pass-qr": { revokeInvitationSpecialPassQr: async (input) => { helperInput = input; return { ok: true, revokedTokenIds: [raw.tokenId] }; } },
    });
    const response = await route.POST(new Request("https://passport.example/qr/revoke", { method: "POST" }), { params: { id: raw.subjectId } });
    assert.equal(helperInput.subjectType, subjectType);
    assert.equal(response.status, 200);
    assert.equal(response.payload.revokedTokenCount, 1);
    const serialized = JSON.stringify(response.payload);
    for (const value of Object.values(raw)) assert.equal(serialized.includes(value), false);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Unified verifier scan route integration
// ─────────────────────────────────────────────────────────────────────────────

test("verifier scan route maps admitted invitation result to data-minimized response", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/verifier/scan/route.ts");

  const prisma = {
    qrToken: {
      findUnique: async () => ({
        id: "token-1",
        tokenHash: "hashed-token-token-1",
        type: "INVITATION_SPECIAL_PASS",
        status: "ACTIVE",
        eventId: "123e4567-e89b-12d3-a456-426614174000",
        subjectType: "invitation_request",
        subjectId: "inv-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10),
        consumedAt: null,
        userId: "user-1",
      }),
    },
  };

  const route = loadModule(sourcePath, {
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hashed-${token}`,
    },
    "next/server": { NextResponse: createNextResponseMock() },
    "@/lib/server/audit": {
      getRequestAuditContext: () => ({}),
      writeCoreAuditLog: async () => null,
    },
    "@/lib/server/achievement-badge": { createAchievementRecord: async () => null },
    "@/lib/server/auth": {
      getCurrentUser: async () => ({ id: "verifier-1", role: "VERIFIER" }),
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/verifier-invitation-special-pass": {
      scanInvitationSpecialPassQr: async () => ({
        result: "admitted",
        credentialKind: "invitation",
        event: { title: "Event Title", titleEn: "Event Title EN" },
        holderName: "Guest One",
      }),
    },
    "@/lib/server/verifier-activity": { canVerifyActivity: async () => false },
    "@/lib/server/activity-rewards": { triggerActivityRewards: async () => null },
  });

  const request = new Request("https://passport.example/api/verifier/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: "token-token-1",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
    }),
  });

  const response = await route.POST(request);

  assert.equal(response.status, 200);
  assert.equal(response.payload.result, "admitted");
  assert.equal(response.payload.credentialKind, "invitation");
  assert.equal(response.payload.holderName, "Guest One");
  assert.equal(response.payload.event.title, "Event Title");
});

for (const [result, status] of [["already_used", 409], ["revoked", 410], ["expired", 410]]) {
  test(`verifier scan route dispatches inactive ${result} pass to dedicated resolver`, async () => {
    const sourcePath = path.resolve("apps/passport-web/app/api/verifier/scan/route.ts");
    let resolverCalls = 0;
    const route = loadModule(sourcePath, {
      "@climate-passport/passport-core": { hashOpaqueToken: () => "hashed" },
      "next/server": { NextResponse: createNextResponseMock() },
      "@/lib/server/audit": { getRequestAuditContext: () => ({}), writeCoreAuditLog: async () => null },
      "@/lib/server/achievement-badge": { createAchievementRecord: async () => null },
      "@/lib/server/auth": { getCurrentUser: async () => ({ id: "verifier-1", role: "VERIFIER" }) },
      "@/lib/server/prisma": { getPrismaClient: () => ({ qrToken: { findUnique: async () => ({ type: "INVITATION_SPECIAL_PASS", status: result === "already_used" ? "CONSUMED" : result === "revoked" ? "REVOKED" : "EXPIRED" }) } }) },
      "@/lib/server/verifier-invitation-special-pass": { scanInvitationSpecialPassQr: async () => { resolverCalls += 1; return { result }; } },
      "@/lib/server/verifier-activity": { canVerifyActivity: async () => false },
      "@/lib/server/activity-rewards": { triggerActivityRewards: async () => null },
    });
    const response = await route.POST(new Request("https://passport.example/api/verifier/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "token-long-enough" }) }));
    assert.equal(resolverCalls, 1);
    assert.equal(response.status, status);
    assert.equal(response.payload.result, result);
  });
}
