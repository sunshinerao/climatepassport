import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const menu = read("apps/passport-web/components/admin-shell.tsx");
const createPage = read("apps/passport-web/app/[locale]/admin/activities/new/page.tsx");
const activityListPage = read("apps/passport-web/app/[locale]/admin/activities/page.tsx");
const activityListClient = read("apps/passport-web/components/admin-activities-client.tsx");
const activityDetailPage = read("apps/passport-web/app/[locale]/admin/activities/[id]/page.tsx");
const activityDetailClient = read("apps/passport-web/components/admin-activity-detail-client.tsx");
const verifierPage = read("apps/passport-web/app/[locale]/admin/activities/[id]/verifiers/page.tsx");

test("EVENT_MANAGER cannot discover or open Activity creation", () => {
  for (const type of ["EVENT", "LEARNING", "CHALLENGE", "PROJECT", "COURSE"]) {
    const link = new RegExp(`href: \\x60\\$\\{prefix\\}/admin/activities/new\\?type=${type}\\x60,[\\s\\S]{0,180}roles: \\["ADMIN"\\]`);
    assert.match(menu, link, `${type} create menu entry is ADMIN-only`);
  }
  assert.match(createPage, /requireRoleAccess\(params\.locale, \["ADMIN"\]/);
});

test("Activity list and detail data are limited to the manager's assigned scope", () => {
  assert.match(activityListPage, /organizerUserId: actor\.id/);
  assert.match(activityListPage, /assertActivityScopeAccess\(prisma, actor, activity\.id, "read"\)/);
  assert.match(activityDetailPage, /organizerUserId !== actor\.id/);
  assert.match(activityDetailPage, /assertActivityScopeAccess\(prisma, actor, params\.id, "read"\)/);
  assert.match(activityDetailPage, /actor\.role === "ADMIN"[\s\S]*?availableVerifiers/);
});

test("Activity list create button is rendered only for ADMIN", () => {
  assert.match(activityListPage, /canCreate=\{actor\.role === "ADMIN"\}/);
  assert.match(activityListClient, /canCreate: boolean/);
  assert.match(activityListClient, /\{canCreate \? \(/);
});

test("Activity P-role detail surface hides lifecycle, rewards, and verifier management", () => {
  assert.match(activityDetailPage, /canManageLifecycle=\{actor\.role === "ADMIN"\}/);
  assert.match(activityDetailPage, /canManageVerifiers=\{actor\.role === "ADMIN"\}/);
  assert.match(activityDetailClient, /canManageLifecycle \? nextActions\.map/);
  assert.ok(activityDetailClient.includes('...(canManageLifecycle ? [{ href: `/${locale}/admin/activities/${activity.id}/rewards`'));
  assert.match(activityDetailClient, /canManageVerifiers \? <article/);
  assert.match(verifierPage, /requireRoleAccess\(params\.locale, \["ADMIN"\]/);
});