import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadTypeScriptModule(sourcePath, moduleMocks) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    exports: {}, module: { exports: {} },
    require: (name) => Object.prototype.hasOwnProperty.call(moduleMocks, name) ? moduleMocks[name] : require(name),
    URL, Request, Response, console,
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

function activity(id, title) {
  return { id, title, titleEn: `${title} EN`, startTime: null, slug: id };
}

test("Activity verification permits only admins, owning managers, and explicit verifier assignments", async () => {
  const assignments = new Set(["verifier-1:activity-assigned"]);
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-activity.ts");
  const prisma = {
    activity: {
      findFirst: async ({ where }) => where.id === "activity-owned" && where.organizerUserId === "manager-1" ? { id: where.id } : null,
    },
    activityVerifier: {
      findUnique: async ({ where }) => assignments.has(`${where.userId_activityId.userId}:${where.userId_activityId.activityId}`) ? { id: "assignment-1" } : null,
    },
  };
  const { canManageActivity, canVerifyActivity } = loadTypeScriptModule(sourcePath, { "./prisma": { getPrismaClient: () => prisma } });

  assert.equal(await canManageActivity(prisma, { id: "admin-1", role: "ADMIN" }, "any"), true);
  assert.equal(await canManageActivity(prisma, { id: "manager-1", role: "EVENT_MANAGER" }, "activity-owned"), true);
  assert.equal(await canManageActivity(prisma, { id: "manager-1", role: "EVENT_MANAGER" }, "activity-other"), false);
  assert.equal(await canManageActivity(prisma, { id: "verifier-1", role: "VERIFIER" }, "activity-assigned"), false);

  assert.equal(await canVerifyActivity(prisma, { id: "admin-1", role: "ADMIN" }, "any"), true);
  assert.equal(await canVerifyActivity(prisma, { id: "manager-1", role: "EVENT_MANAGER" }, "activity-owned"), true);
  assert.equal(await canVerifyActivity(prisma, { id: "manager-1", role: "EVENT_MANAGER" }, "activity-other"), false);
  assert.equal(await canVerifyActivity(prisma, { id: "verifier-1", role: "VERIFIER" }, "activity-assigned"), true);
  assert.equal(await canVerifyActivity(prisma, { id: "verifier-1", role: "VERIFIER" }, "activity-participated-only"), false);
  assert.equal(await canVerifyActivity(prisma, { id: "attendee-1", role: "ATTENDEE" }, "activity-assigned"), false);
});

test("Activity verifier lists select only authorized activities and retain activity titles", async () => {
  const calls = [];
  const sourcePath = path.resolve("apps/passport-web/lib/server/verifier-activity.ts");
  const prisma = {
    activity: {
      findMany: async (args) => {
        calls.push(args);
        return args.where.organizerUserId ? [activity("manager-activity", "Managed activity")] : [activity("admin-activity", "Admin activity")];
      },
    },
    activityVerifier: {
      findMany: async (args) => {
        calls.push(args);
        return [{ activity: activity("assigned-activity", "Assigned activity") }];
      },
    },
  };
  const { loadVerifiableActivities } = loadTypeScriptModule(sourcePath, { "./prisma": { getPrismaClient: () => prisma } });

  assert.equal(JSON.stringify(await loadVerifiableActivities({ id: "admin-1", role: "ADMIN" })), JSON.stringify([activity("admin-activity", "Admin activity")]));
  assert.equal(JSON.stringify(await loadVerifiableActivities({ id: "manager-1", role: "EVENT_MANAGER" })), JSON.stringify([activity("manager-activity", "Managed activity")]));
  assert.equal(JSON.stringify(await loadVerifiableActivities({ id: "verifier-1", role: "VERIFIER" })), JSON.stringify([activity("assigned-activity", "Assigned activity")]));
  assert.equal(JSON.stringify(await loadVerifiableActivities({ id: "attendee-1", role: "ATTENDEE" })), "[]");
  assert.equal(calls[2].where.userId, "verifier-1");
  assert.equal(JSON.stringify(calls[2].where.activity.status.in), JSON.stringify(["PUBLISHED", "ONGOING"]));
  assert.equal(calls[2].include.activity.select.title, true);
  assert.equal(calls[2].include.activity.select.titleEn, true);
});

test("Activity verifier assignment routes enforce manager ownership while admins remain global", async () => {
  const sourcePath = path.resolve("apps/passport-web/app/api/activities/[id]/verifiers/route.ts");
  let actor = { id: "manager-1", role: "EVENT_MANAGER" };
  let assigned = false;
  const prisma = {
    activity: { findFirst: async ({ where }) => where.organizerUserId === actor.id && where.id === "owned" ? { id: "owned" } : null },
    activityVerifier: {
      findMany: async () => [{ id: "assignment-1" }],
      findUnique: async () => assigned ? { id: "assignment-1" } : null,
      create: async ({ data }) => {
        assigned = true;
        return { id: "assignment-new", ...data };
      },
      delete: async () => null,
    },
    user: { findUnique: async () => ({ id: "verifier-1", role: "VERIFIER" }) },
  };
  const route = loadTypeScriptModule(sourcePath, {
    "next/server": { NextResponse: { json: (payload, init) => ({ status: init?.status ?? 200, payload }) }, NextRequest: class {} },
    "@/lib/server/auth": { requireRoleAccess: async () => actor },
    "@/lib/server/prisma": { getPrismaClient: () => prisma },
  });

  const denied = await route.GET(new Request("https://example.test/api/activities/other/verifiers"), { params: { id: "other" } });
  assert.equal(denied.status, 404);
  const deniedAdd = await route.POST(new Request("https://example.test/api/activities/other/verifiers", { method: "POST", body: JSON.stringify({ userId: "verifier-1" }) }), { params: { id: "other" } });
  assert.equal(deniedAdd.status, 404);
  const deniedRemove = await route.DELETE(new Request("https://example.test/api/activities/other/verifiers?userId=verifier-1", { method: "DELETE" }), { params: { id: "other" } });
  assert.equal(deniedRemove.status, 404);
  const listed = await route.GET(new Request("https://example.test/api/activities/owned/verifiers"), { params: { id: "owned" } });
  assert.equal(listed.status, 200);
  const added = await route.POST(new Request("https://example.test/api/activities/owned/verifiers", { method: "POST", body: JSON.stringify({ userId: "verifier-1" }) }), { params: { id: "owned" } });
  assert.equal(added.status, 200);
  const removed = await route.DELETE(new Request("https://example.test/api/activities/owned/verifiers?userId=verifier-1", { method: "DELETE" }), { params: { id: "owned" } });
  assert.equal(removed.status, 200);

  actor = { id: "admin-1", role: "ADMIN" };
  const adminListed = await route.GET(new Request("https://example.test/api/activities/other/verifiers"), { params: { id: "other" } });
  assert.equal(adminListed.status, 200);
});
