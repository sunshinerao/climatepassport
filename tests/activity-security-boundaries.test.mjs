import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { createNextResponseMock, loadRouteModule } from "./_route-loader.mjs";

function loadParticipationRules() {
  const source = fs.readFileSync("apps/passport-web/lib/server/activity-participation.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandbox = { exports: {}, module: { exports: {} } };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox);
  return sandbox.module.exports;
}

test("Activity participation rules reject arbitrary values and terminal rewrites", () => {
  const rules = loadParticipationRules();
  assert.equal(rules.isActivityParticipationStatus("COMPLETED"), true);
  assert.equal(rules.isActivityParticipationStatus("OWNER_DEFINED"), false);
  assert.equal(rules.canTransitionActivityParticipation("CHECKED_IN", "COMPLETED"), true);
  assert.equal(rules.canTransitionActivityParticipation("CERTIFIED", "REGISTERED"), false);
  assert.equal(rules.canTransitionActivityParticipation("ARCHIVED", "COMPLETED"), false);
});

test("Activity API scopes managers to owned rows and reserves creation for ADMIN", async () => {
  const routePath = path.resolve("apps/passport-web/app/api/activities/route.ts");
  let listWhere = null;
  let createdData = null;
  let actor = { id: "manager-1", role: "EVENT_MANAGER" };
  const NextResponse = createNextResponseMock();
  const prisma = {
    activity: {
      count: async ({ where }) => { listWhere = where; return 1; },
      findMany: async ({ where }) => { listWhere = where; return []; },
      findUnique: async () => null,
      create: async ({ data }) => { createdData = data; return { id: "created-1", ...data }; },
    },
  };
  const mocks = {
    "next/server": { NextResponse },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/api-auth": {
      requireApiRole: async (roles) => roles.includes(actor.role)
        ? actor
        : NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    },
  };
  const route = loadRouteModule(routePath, mocks);

  const listed = await route.GET(new Request("https://example.test/api/activities"));
  assert.equal(listed.status, 200);
  assert.equal(listWhere.organizerUserId, "manager-1");

  const deniedCreate = await route.POST(new Request("https://example.test/api/activities", {
    method: "POST",
    body: JSON.stringify({ type: "EVENT", title: "No", slug: "no", createdByUserId: "manager-1" }),
  }));
  assert.equal(deniedCreate.status, 403);
  assert.equal(createdData, null);

  actor = { id: "admin-1", role: "ADMIN" };
  const adminRoute = loadRouteModule(routePath, {
    ...mocks,
  });
  const acceptedCreate = await adminRoute.POST(new Request("https://example.test/api/activities", {
    method: "POST",
    body: JSON.stringify({ type: "EVENT", title: "Allowed", slug: "allowed", createdByUserId: "spoofed-user" }),
  }));
  assert.equal(acceptedCreate.status, 201);
  assert.equal(createdData.createdByUserId, "admin-1");
});

test("Activity detail and PATCH enforce assignment, Programme scope, and manager field boundaries", async () => {
  const routePath = path.resolve("apps/passport-web/app/api/activities/[id]/route.ts");
  const NextResponse = createNextResponseMock();
  const activity = { id: "activity-1", organizerUserId: "manager-1", type: "EVENT", title: "Before" };
  let actor = { id: "manager-other", role: "EVENT_MANAGER" };
  let scopeAllowed = true;
  let updateData = null;
  const prisma = {
    activity: {
      findUnique: async () => activity,
      update: async ({ data }) => { updateData = data; return { ...activity, ...data }; },
      findFirst: async () => ({ id: activity.id, organizerUserId: activity.organizerUserId }),
    },
  };
  const mocks = {
    "next/server": { NextResponse },
    "@/lib/server/api-auth": { requireApiRole: async () => actor },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/verifier-activity": {
      canManageActivity: async (_prisma, user) => user.role === "ADMIN" || activity.organizerUserId === user.id,
    },
    "@/lib/server/programme-scope": {
      assertActivityScopeAccess: async () => scopeAllowed ? { ok: true } : { ok: false, status: 403, error: "Forbidden" },
    },
    "@/lib/server/source-activity-mapping": { listSourceOwnedFieldConflicts: async () => [] },
  };
  const route = loadRouteModule(routePath, mocks);

  const deniedRead = await route.GET(new Request("https://example.test/api/activities/activity-1"), { params: { id: activity.id } });
  assert.equal(deniedRead.status, 403);

  actor = { id: "manager-1", role: "EVENT_MANAGER" };
  scopeAllowed = false;
  const deniedScope = await route.GET(new Request("https://example.test/api/activities/activity-1"), { params: { id: activity.id } });
  assert.equal(deniedScope.status, 403);

  scopeAllowed = true;
  const allowedRead = await route.GET(new Request("https://example.test/api/activities/activity-1"), { params: { id: activity.id } });
  assert.equal(allowedRead.status, 200);

  const deniedOwnerChange = await route.PATCH(new Request("https://example.test/api/activities/activity-1", {
    method: "PATCH", body: JSON.stringify({ organizerUserId: "manager-other" }),
  }), { params: { id: activity.id } });
  assert.equal(deniedOwnerChange.status, 403);
  assert.equal(updateData, null);

  const allowedContentEdit = await route.PATCH(new Request("https://example.test/api/activities/activity-1", {
    method: "PATCH", body: JSON.stringify({ title: "Updated title" }),
  }), { params: { id: activity.id } });
  assert.equal(allowedContentEdit.status, 200);
  assert.equal(updateData.title, "Updated title");
});

test("only ADMIN can manage verifier assignments from the Activity detail surface", async () => {
  const routePath = path.resolve("apps/passport-web/app/api/activities/[id]/verifiers/route.ts");
  const NextResponse = createNextResponseMock();
  let actor = { id: "manager-1", role: "EVENT_MANAGER" };
  let created = false;
  let deleted = false;
  const prisma = {
    activity: { findFirst: async () => ({ id: "activity-1" }) },
    user: { findUnique: async () => ({ id: "verifier-1", role: "VERIFIER" }) },
    activityVerifier: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async ({ data }) => { created = true; return { id: "assignment-1", ...data, user: { id: data.userId } }; },
      delete: async () => { deleted = true; },
    },
  };
  const route = loadRouteModule(routePath, {
    "next/server": { NextResponse },
    "@/lib/server/api-auth": {
      requireApiRole: async (roles) => roles.includes(actor.role)
        ? actor
        : NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
  });

  assert.equal((await route.GET(new Request("https://example.test/api/activities/activity-1/verifiers"), { params: { id: "activity-1" } })).status, 403);
  assert.equal((await route.POST(new Request("https://example.test/api/activities/activity-1/verifiers", { method: "POST", body: JSON.stringify({ userId: "verifier-1" }) }), { params: { id: "activity-1" } })).status, 403);
  assert.equal((await route.DELETE(new Request("https://example.test/api/activities/activity-1/verifiers?userId=verifier-1", { method: "DELETE" }), { params: { id: "activity-1" } })).status, 403);
  assert.equal(created, false);
  assert.equal(deleted, false);

  actor = { id: "admin-1", role: "ADMIN" };
  const assigned = await route.POST(new Request("https://example.test/api/activities/activity-1/verifiers", { method: "POST", body: JSON.stringify({ userId: "verifier-1" }) }), { params: { id: "activity-1" } });
  assert.equal(assigned.status, 200);
  assert.equal(created, true);
});

test("EVENT_MANAGER cannot transition Activity lifecycle status", async () => {
  const routePath = path.resolve("apps/passport-web/app/api/activities/[id]/status/route.ts");
  const NextResponse = createNextResponseMock();
  let actor = { id: "manager-1", role: "EVENT_MANAGER" };
  let updated = false;
  const prisma = {
    activity: {
      findFirst: async () => ({ id: "activity-1", organizerUserId: "manager-1" }),
      findUnique: async () => ({ id: "activity-1", status: "DRAFT" }),
      update: async ({ data }) => { updated = true; return { id: "activity-1", ...data }; },
    },
  };
  const route = loadRouteModule(routePath, {
    "next/server": { NextResponse },
    "@/lib/server/api-auth": {
      requireApiRole: async (roles) => roles.includes(actor.role)
        ? actor
        : NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/verifier-activity": { canManageActivity: async () => true },
  });

  const managerAttempt = await route.PATCH(new Request("https://example.test/api/activities/activity-1/status", {
    method: "PATCH", body: JSON.stringify({ status: "PUBLISHED" }),
  }), { params: { id: "activity-1" } });
  assert.equal(managerAttempt.status, 403);
  assert.equal(updated, false);

  actor = { id: "admin-1", role: "ADMIN" };
  const adminAttempt = await route.PATCH(new Request("https://example.test/api/activities/activity-1/status", {
    method: "PATCH", body: JSON.stringify({ status: "PUBLISHED" }),
  }), { params: { id: "activity-1" } });
  assert.equal(adminAttempt.status, 200);
  assert.equal(updated, true);
});

test("participation PATCH is activity-scoped and rejects server-owned asset fields", async () => {
  const routePath = path.resolve("apps/passport-web/app/api/activity-participations/[id]/route.ts");
  const actor = { id: "manager-1", role: "EVENT_MANAGER" };
  let updated = false;
  const prisma = {
    activityParticipation: {
      findUnique: async () => ({ id: "part-1", activityId: "activity-1", userId: "user-1", status: "CHECKED_IN", completedAt: null }),
      update: async ({ data }) => { updated = true; return { id: "part-1", activityId: "activity-1", userId: "user-1", ...data }; },
    },
  };
  const rules = loadParticipationRules();
  const mocks = {
    "@/lib/server/auth": { requireRoleAccess: async () => actor },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/activity-participation": rules,
    "@/lib/server/verifier-activity": { canManageActivity: async () => false },
  };
  let route = loadRouteModule(routePath, mocks);
  const injected = await route.PATCH(new Request("https://example.test/api/activity-participations/part-1", { method: "PATCH", body: JSON.stringify({ status: "COMPLETED", pointsEarned: 9999 }) }), { params: { id: "part-1" } });
  assert.equal(injected.status, 400);
  assert.equal(updated, false);

  const denied = await route.PATCH(new Request("https://example.test/api/activity-participations/part-1", { method: "PATCH", body: JSON.stringify({ status: "COMPLETED" }) }), { params: { id: "part-1" } });
  assert.equal(denied.status, 403);
  assert.equal(updated, false);

  route = loadRouteModule(routePath, { ...mocks, "@/lib/server/verifier-activity": { canManageActivity: async () => true } });
  const accepted = await route.PATCH(new Request("https://example.test/api/activity-participations/part-1", { method: "PATCH", body: JSON.stringify({ status: "COMPLETED" }) }), { params: { id: "part-1" } });
  assert.equal(accepted.status, 200);
  assert.equal(updated, true);
  assert.equal(accepted.payload.participation.status, "COMPLETED");
  assert.ok(accepted.payload.participation.completedAt instanceof Date);
});

test("Passport sync permits the participant and owning manager only", async () => {
  const routePath = path.resolve("apps/passport-web/app/api/activity-participations/[id]/sync-passport/route.ts");
  const prisma = { activityParticipation: { findUnique: async () => ({ userId: "owner-1", activityId: "activity-1", status: "COMPLETED", passportSynced: false }) } };
  const base = {
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
    "@/lib/server/activity-rewards": { syncParticipationToPassport: async () => {} },
  };
  let route = loadRouteModule(routePath, {
    ...base,
    "@/lib/server/auth": { requireAuthenticatedUser: async () => ({ id: "manager-other", role: "EVENT_MANAGER" }) },
    "@/lib/server/verifier-activity": { canManageActivity: async () => false },
  });
  assert.equal((await route.POST(new Request("https://example.test"), { params: { id: "part-1" } })).status, 403);
  route = loadRouteModule(routePath, {
    ...base,
    "@/lib/server/auth": { requireAuthenticatedUser: async () => ({ id: "owner-1", role: "ATTENDEE" }) },
    "@/lib/server/verifier-activity": { canManageActivity: async () => false },
  });
  assert.equal((await route.POST(new Request("https://example.test"), { params: { id: "part-1" } })).status, 200);
});

test("application export is owner-scoped, consent-minimized and CSV-injection safe", async () => {
  const routePath = path.resolve("apps/passport-web/app/api/activities/[id]/applications/export/route.ts");
  const actor = { id: "manager-1", role: "EVENT_MANAGER" };
  const prisma = {
    activity: { findUnique: async () => ({ id: "project-1", type: "PROJECT", title: "Project", slug: "project" }) },
    activityApplication: {
      findMany: async () => [{
        roleType: "PARTICIPANT", status: "SUBMITTED", submittedAt: new Date("2026-01-01T00:00:00Z"), reviewedAt: null,
        user: { name: "=HYPERLINK(\"bad\")", email: "private@example.test" }, projectConsent: { shareName: true, shareEmail: false },
      }],
    },
  };
  const base = {
    "@/lib/server/auth": { getCurrentUser: async () => actor, requireRoleAccess: async () => actor },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
  };
  let route = loadRouteModule(routePath, { ...base, "@/lib/server/verifier-activity": { canManageActivity: async () => false } });
  assert.equal((await route.GET(new Request("https://example.test/api/activities/project-1/applications/export"), { params: { id: "project-1" } })).status, 403);

  route = loadRouteModule(routePath, { ...base, "@/lib/server/verifier-activity": { canManageActivity: async () => true } });
  const response = await route.GET(new Request("https://example.test/api/activities/project-1/applications/export"), { params: { id: "project-1" } });
  assert.equal(response.status, 200);
  assert.match(response.body, /'\=HYPERLINK/);
  assert.equal(response.body.includes("private@example.test"), false);
  assert.equal(response.body.includes("Climate Passport ID"), false);
  assert.equal(response.body.includes("Review Comment"), false);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
});

test("legacy QR endpoint preserves POST through a redirect to the canonical scanner", async () => {
  const route = loadRouteModule(path.resolve("apps/passport-web/app/api/checkin/activity-verify/route.ts"));
  const response = await route.POST(new Request("https://example.test/api/checkin/activity-verify", { method: "POST", body: "{}" }));
  assert.equal(response.status, 307);
  assert.equal(response.payload.url.toString(), "https://example.test/api/verifier/scan");
});

test("direct check-in requires activity assignment and derives the verifier from the session", async () => {
  const routePath = path.resolve("apps/passport-web/app/api/activity-checkin/route.ts");
  const actor = { id: "verifier-1", role: "VERIFIER" };
  let recordedData = null;
  const tx = {
    activityParticipation: { updateMany: async () => ({ count: 1 }) },
    activityCheckinRecord: {
      findFirst: async () => null,
      create: async ({ data }) => { recordedData = data; return { id: "checkin-1", checkinAt: data.checkinAt }; },
    },
  };
  const prisma = {
    activityTask: { findFirst: async () => ({ id: "task-1" }) },
    activityParticipation: { findUnique: async () => ({ id: "part-1", status: "ACCEPTED" }) },
    $transaction: async (callback) => callback(tx),
  };
  const base = {
    "@/lib/server/auth": { getCurrentUser: async () => actor, requireRoleAccess: async () => actor },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
  };
  const request = () => new Request("https://example.test/api/activity-checkin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ activityId: "activity-1", userId: "user-1", method: "MANUAL", verifiedByUserId: "attacker-selected" }),
  });

  let route = loadRouteModule(routePath, { ...base, "@/lib/server/verifier-activity": { canVerifyActivity: async () => false, canManageActivity: async () => false } });
  assert.equal((await route.POST(request())).status, 403);
  assert.equal(recordedData, null);

  route = loadRouteModule(routePath, { ...base, "@/lib/server/verifier-activity": { canVerifyActivity: async () => true, canManageActivity: async () => false } });
  const accepted = await route.POST(request());
  assert.equal(accepted.status, 201);
  assert.equal(recordedData.verifiedByUserId, "verifier-1");
  assert.equal(recordedData.verifiedByUserId === "attacker-selected", false);
});
