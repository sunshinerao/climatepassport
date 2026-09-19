import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { loadRouteModule } from "./_route-loader.mjs";

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
