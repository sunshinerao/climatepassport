/**
 * 源码级测试：V2.1 多 Programme scope 授权服务（CP-TODO-241 / CP-FR-050/051）
 *
 * 覆盖（vm/transpile + 内存 Prisma mock）：
 * - 默认拒绝；匿名拒绝；未知 scope 拒绝；跨 Programme/跨 Edition 拒绝
 * - scope 中 edition 与 programme 不一致（conflicting）拒绝；归档 Edition 拒绝
 * - 角色层级：VIEWER 只读、OPERATOR 读写、ADMIN 可 manage
 * - 有效期窗口：未生效、已过期、已撤销、isActive=false 全部拒绝
 * - Programme 级成员（editionId=null）覆盖同 Programme 任意 Edition，但不跨 Programme
 * - 对象级授权：ObjectAuthorization 精确对象 + action 等级覆盖（MANAGE>WRITE>READ）+ edition 绑定
 * - 机构代表权：InstitutionRepresentation 按动作范围授权；任职关系不参与判定（服务不读取 PersonAffiliation）
 * - resolveActivityScope：无映射 → null（遗留对象放行）；WITHDRAWN 映射不参与
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadProgrammeScopeModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/programme-scope.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require: (name) => { throw new Error(`unexpected import: ${name}`); } };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const service = loadProgrammeScopeModule();

function prismaMock({
  programmes = [],
  editions = [],
  memberships = [],
  grants = [],
  representations = [],
  mappings = [],
} = {}) {
  const now = () => new Date();
  const inWindow = (row) =>
    (row.validFrom == null || row.validFrom <= now()) &&
    (row.validUntil == null || row.validUntil > now()) &&
    row.revokedAt == null &&
    row.isActive !== false;

  return {
    programme: {
      findFirst: async ({ where }) =>
        programmes.find((row) => row.id === where.id && row.isActive === where.isActive) ?? null,
    },
    edition: {
      findFirst: async ({ where }) =>
        editions.find(
          (row) =>
            row.id === where.id &&
            row.isActive === where.isActive &&
            (where.archivedAt === null ? row.archivedAt == null : true) &&
            row.programmeId === (where.programmeId ?? row.programmeId),
        ) ?? null,
    },
    accessMembership: {
      findMany: async ({ where }) =>
        memberships.filter((row) => {
          if (row.userId !== where.userId || row.programmeId !== where.programmeId) return false;
          if (!inWindow(row)) return false;
          if (where.OR) {
            return row.editionId == null || where.OR.some((cond) => cond.editionId === row.editionId);
          }
          return (row.editionId ?? null) === (where.editionId ?? null);
        }),
    },
    objectAuthorization: {
      findFirst: async ({ where }) =>
        grants.find(
          (row) =>
            row.subjectUserId === where.subjectUserId &&
            row.objectType === where.objectType &&
            row.objectId === where.objectId &&
            row.programmeId === where.programmeId &&
            inWindow(row) &&
            (where.OR ? row.editionId == null || where.OR.some((cond) => cond.editionId === row.editionId) : row.editionId === where.editionId),
        ) ?? null,
    },
    institutionRepresentation: {
      findFirst: async ({ where }) =>
        representations.find(
          (row) =>
            row.institutionId === where.institutionId &&
            row.userId === where.userId &&
            row.programmeId === where.programmeId &&
            row.status === where.status &&
            inWindow(row) &&
            (where.OR ? row.editionId == null || where.OR.some((cond) => cond.editionId === row.editionId) : row.editionId === where.editionId),
        ) ?? null,
    },
    sourceObjectMapping: {
      findFirst: async ({ where }) =>
        mappings.find(
          (row) =>
            row.activityId === where.activityId &&
            row.applyStatus === where.applyStatus,
        ) ?? null,
    },
  };
}

const P1 = { id: "prog-1", isActive: true };
const P2 = { id: "prog-2", isActive: true };
const P_INACTIVE = { id: "prog-x", isActive: false };
const E1A = { id: "ed-1a", programmeId: "prog-1", isActive: true, archivedAt: null };
const E1B = { id: "ed-1b", programmeId: "prog-1", isActive: true, archivedAt: null };
const E2A = { id: "ed-2a", programmeId: "prog-2", isActive: true, archivedAt: null };
const E_ARCHIVED = { id: "ed-arch", programmeId: "prog-1", isActive: true, archivedAt: new Date() };

const baseWorld = () => ({
  programmes: [P1, P2, P_INACTIVE],
  editions: [E1A, E1B, E2A, E_ARCHIVED],
});

test("default deny: no membership, no grant → denied", async () => {
  const decision = await service.resolveScopedAccess(prismaMock(baseWorld()), { id: "u1" }, { programmeId: "prog-1", editionId: "ed-1a" }, "read");
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "no_active_grant");
});

test("anonymous actor is denied even when a membership exists", async () => {
  const prisma = prismaMock({
    ...baseWorld(),
    memberships: [{ userId: "u1", programmeId: "prog-1", editionId: null, role: "PROGRAMME_ADMIN" }],
  });
  const decision = await service.resolveScopedAccess(prisma, null, { programmeId: "prog-1" }, "read");
  assert.equal(decision.allowed, false);
});

test("unknown or inactive programme scope is rejected as unknown_scope", async () => {
  const prisma = prismaMock(baseWorld());
  const missing = await service.resolveScopedAccess(prisma, { id: "u1" }, { programmeId: "prog-missing" }, "read");
  assert.equal(missing.allowed, false);
  assert.equal(missing.reason, "unknown_scope");
  const inactive = await service.resolveScopedAccess(prisma, { id: "u1" }, { programmeId: "prog-x" }, "read");
  assert.equal(inactive.allowed, false);
  assert.equal(inactive.reason, "unknown_scope");
});

test("edition that does not belong to the programme scope is rejected", async () => {
  const prisma = prismaMock({
    ...baseWorld(),
    memberships: [{ userId: "u1", programmeId: "prog-1", editionId: null, role: "PROGRAMME_ADMIN" }],
  });
  const decision = await service.resolveScopedAccess(prisma, { id: "u1" }, { programmeId: "prog-1", editionId: "ed-2a" }, "read");
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "unknown_scope");
});

test("archived edition scope is rejected", async () => {
  const prisma = prismaMock(baseWorld());
  const decision = await service.resolveScopedAccess(prisma, { id: "u1" }, { programmeId: "prog-1", editionId: "ed-arch" }, "read");
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "unknown_scope");
});

test("same programme + same edition membership grants read and write", async () => {
  const prisma = prismaMock({
    ...baseWorld(),
    memberships: [{ userId: "u1", programmeId: "prog-1", editionId: "ed-1a", role: "PROGRAMME_OPERATOR" }],
  });
  const read = await service.resolveScopedAccess(prisma, { id: "u1" }, { programmeId: "prog-1", editionId: "ed-1a" }, "read");
  assert.equal(read.allowed, true);
  assert.equal(read.via, "membership");
  const write = await service.resolveScopedAccess(prisma, { id: "u1" }, { programmeId: "prog-1", editionId: "ed-1a" }, "write");
  assert.equal(write.allowed, true);
});

test("edition-specific membership does not cross editions; programme-wide membership does", async () => {
  const prisma = prismaMock({
    ...baseWorld(),
    memberships: [{ userId: "u1", programmeId: "prog-1", editionId: "ed-1b", role: "PROGRAMME_ADMIN" }],
  });
  const crossEdition = await service.resolveScopedAccess(prisma, { id: "u1" }, { programmeId: "prog-1", editionId: "ed-1a" }, "read");
  assert.equal(crossEdition.allowed, false, "edition-scoped membership must not cross editions");

  const programmeWide = prismaMock({
    ...baseWorld(),
    memberships: [{ userId: "u1", programmeId: "prog-1", editionId: null, role: "PROGRAMME_ADMIN" }],
  });
  const viaWide = await service.resolveScopedAccess(programmeWide, { id: "u1" }, { programmeId: "prog-1", editionId: "ed-1a" }, "read");
  assert.equal(viaWide.allowed, true, "programme-wide membership covers editions of the same programme");
  const crossProgramme = await service.resolveScopedAccess(programmeWide, { id: "u1" }, { programmeId: "prog-2", editionId: "ed-2a" }, "read");
  assert.equal(crossProgramme.allowed, false, "programme-wide membership must not cross programmes");
});

test("role hierarchy: VIEWER cannot write, OPERATOR cannot manage", async () => {
  const viewer = prismaMock({
    ...baseWorld(),
    memberships: [{ userId: "u1", programmeId: "prog-1", editionId: null, role: "PROGRAMME_VIEWER" }],
  });
  assert.equal((await service.resolveScopedAccess(viewer, { id: "u1" }, { programmeId: "prog-1" }, "read")).allowed, true);
  assert.equal((await service.resolveScopedAccess(viewer, { id: "u1" }, { programmeId: "prog-1" }, "write")).allowed, false);

  const operator = prismaMock({
    ...baseWorld(),
    memberships: [{ userId: "u1", programmeId: "prog-1", editionId: null, role: "PROGRAMME_OPERATOR" }],
  });
  assert.equal((await service.resolveScopedAccess(operator, { id: "u1" }, { programmeId: "prog-1" }, "manage")).allowed, false);
});

test("expired, not-yet-valid, revoked and deactivated memberships are denied", async () => {
  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 60_000);
  const cases = [
    { label: "expired", row: { validFrom: null, validUntil: past, revokedAt: null, isActive: true } },
    { label: "not yet valid", row: { validFrom: future, validUntil: null, revokedAt: null, isActive: true } },
    { label: "revoked", row: { validFrom: null, validUntil: null, revokedAt: past, isActive: true } },
    { label: "deactivated", row: { validFrom: null, validUntil: null, revokedAt: null, isActive: false } },
  ];
  for (const { label, row } of cases) {
    const prisma = prismaMock({
      ...baseWorld(),
      memberships: [{ userId: "u1", programmeId: "prog-1", editionId: null, role: "PROGRAMME_ADMIN", ...row }],
    });
    const decision = await service.resolveScopedAccess(prisma, { id: "u1" }, { programmeId: "prog-1" }, "read");
    assert.equal(decision.allowed, false, `membership must be denied when ${label}`);
  }
});

test("object authorization grants non-members access to the exact object with ranked actions", async () => {
  const prisma = prismaMock({
    ...baseWorld(),
    grants: [{ subjectUserId: "u9", objectType: "activity", objectId: "act-1", programmeId: "prog-1", editionId: "ed-1a", action: "WRITE", validFrom: null, validUntil: null, revokedAt: null, isActive: true }],
  });
  const read = await service.resolveScopedAccess(prisma, { id: "u9" }, { programmeId: "prog-1", editionId: "ed-1a" }, "read", { objectType: "activity", objectId: "act-1" });
  assert.equal(read.allowed, true);
  assert.equal(read.via, "object_authorization");
  const write = await service.resolveScopedAccess(prisma, { id: "u9" }, { programmeId: "prog-1", editionId: "ed-1a" }, "write", { objectType: "activity", objectId: "act-1" });
  assert.equal(write.allowed, true, "WRITE grant covers read and write");
  const manage = await service.resolveScopedAccess(prisma, { id: "u9" }, { programmeId: "prog-1", editionId: "ed-1a" }, "manage", { objectType: "activity", objectId: "act-1" });
  assert.equal(manage.allowed, false, "WRITE grant must not cover manage");
  const otherObject = await service.resolveScopedAccess(prisma, { id: "u9" }, { programmeId: "prog-1", editionId: "ed-1a" }, "read", { objectType: "activity", objectId: "act-2" });
  assert.equal(otherObject.allowed, false, "grant is per-object");
});

test("edition-bound object authorization does not leak across editions", async () => {
  const prisma = prismaMock({
    ...baseWorld(),
    grants: [{ subjectUserId: "u9", objectType: "activity", objectId: "act-1", programmeId: "prog-1", editionId: "ed-1a", action: "MANAGE", validFrom: null, validUntil: null, revokedAt: null, isActive: true }],
  });
  const crossEdition = await service.resolveScopedAccess(prisma, { id: "u9" }, { programmeId: "prog-1", editionId: "ed-1b" }, "read", { objectType: "activity", objectId: "act-1" });
  assert.equal(crossEdition.allowed, false);
});

test("institution representation grants only its action scope and only while active", async () => {
  const world = (overrides = {}) => ({
    ...baseWorld(),
    representations: [
      { institutionId: "inst-1", userId: "u7", programmeId: "prog-1", editionId: null, actionScope: ["READ"], status: "ACTIVE", validFrom: null, validUntil: null, revokedAt: null, isActive: true, ...overrides },
    ],
  });
  const prisma = prismaMock(world());
  const allowed = await service.resolveScopedAccess(prisma, { id: "u7" }, { programmeId: "prog-1" }, "read", { objectType: "institution", objectId: "inst-1" });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.via, "institution_representation");
  const write = await service.resolveScopedAccess(prismaMock(world()), { id: "u7" }, { programmeId: "prog-1" }, "write", { objectType: "institution", objectId: "inst-1" });
  assert.equal(write.allowed, false, "representation action scope is limited to read");

  const suspended = await service.resolveScopedAccess(prismaMock(world({ status: "SUSPENDED" })), { id: "u7" }, { programmeId: "prog-1" }, "read", { objectType: "institution", objectId: "inst-1" });
  assert.equal(suspended.allowed, false, "suspended representation is denied");
  const otherProgramme = await service.resolveScopedAccess(prismaMock(world()), { id: "u7" }, { programmeId: "prog-2", editionId: "ed-2a" }, "read", { objectType: "institution", objectId: "inst-1" });
  assert.equal(otherProgramme.allowed, false, "representation is programme-scoped");
});

test("resolveActivityScope returns null without an ACTIVE mapping and scope otherwise", async () => {
  const prisma = prismaMock({
    ...baseWorld(),
    mappings: [
      { activityId: "act-legacy", applyStatus: "ACTIVE", programmeId: "prog-1", editionId: "ed-1a" },
      { activityId: "act-withdrawn", applyStatus: "WITHDRAWN", programmeId: "prog-1", editionId: "ed-1a" },
    ],
  });
  assert.equal(await service.resolveActivityScope(prisma, "act-none"), null);
  assert.equal(await service.resolveActivityScope(prisma, "act-withdrawn"), null, "withdrawn mapping does not bind a scope");
  const scope = await service.resolveActivityScope(prisma, "act-legacy");
  assert.equal(scope.programmeId, "prog-1");
  assert.equal(scope.editionId, "ed-1a");
});

test("assertActivityScopeAccess keeps legacy objects open and denies unscoped actors on scoped objects", async () => {
  const prisma = prismaMock({
    ...baseWorld(),
    mappings: [{ activityId: "act-1", applyStatus: "ACTIVE", programmeId: "prog-1", editionId: "ed-1a" }],
    memberships: [{ userId: "u1", programmeId: "prog-1", editionId: "ed-1a", role: "PROGRAMME_VIEWER" }],
  });

  const unmappedAnonymous = await service.assertActivityScopeAccess(prisma, null, "act-unmapped", "read");
  assert.equal(unmappedAnonymous.ok, true);
  const unmappedStranger = await service.assertActivityScopeAccess(prisma, { id: "stranger" }, "act-unmapped", "write");
  assert.equal(unmappedStranger.ok, true, "unmapped legacy objects keep existing behavior");

  const anonymous = await service.assertActivityScopeAccess(prisma, null, "act-1", "read");
  assert.equal(anonymous.ok, false);
  assert.equal(anonymous.status, 403);
  const stranger = await service.assertActivityScopeAccess(prisma, { id: "stranger" }, "act-1", "read");
  assert.equal(stranger.ok, false);
  const strangerWithGrant = prismaMock({
    ...baseWorld(),
    mappings: [{ activityId: "act-1", applyStatus: "ACTIVE", programmeId: "prog-1", editionId: "ed-1a" }],
    grants: [{ subjectUserId: "stranger", objectType: "activity", objectId: "act-1", programmeId: "prog-1", editionId: "ed-1a", action: "READ", validFrom: null, validUntil: null, revokedAt: null, isActive: true }],
  });
  const viaGrant = await service.assertActivityScopeAccess(strangerWithGrant, { id: "stranger" }, "act-1", "read");
  assert.equal(viaGrant.ok, true, "object-level READ grant must allow the scoped read");
  const member = await service.assertActivityScopeAccess(prisma, { id: "u1" }, "act-1", "read");
  assert.equal(member.ok, true);
  const memberWrite = await service.assertActivityScopeAccess(prisma, { id: "u1" }, "act-1", "write");
  assert.equal(memberWrite.ok, false, "VIEWER membership does not cover write");
});
