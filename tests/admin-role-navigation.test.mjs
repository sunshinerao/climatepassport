import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("achievement moderation is ADMIN-only", () => {
  const source = read("apps/passport-web/app/[locale]/admin/achievements/page.tsx");
  assert.match(source, /requireRoleAccess\(params\.locale, \["ADMIN"\], `\/\$\{params\.locale\}\/admin\/achievements`\)/);
  assert.doesNotMatch(source, /\["ADMIN", "EVENT_MANAGER"\]/);
});

test("activity check-in uses its locale, an admin role guard, and a localized Link breadcrumb", () => {
  const source = read("apps/passport-web/app/[locale]/admin/activities-checkin/page.tsx");
  assert.match(source, /import Link from "next\/link"/);
  assert.match(source, /requireRoleAccess\(params\.locale, \["ADMIN", "EVENT_MANAGER"\], `\/\$\{params\.locale\}\/admin\/activities-checkin`\)/);
  assert.doesNotMatch(source, /VERIFIER|"en" as any|href="\/admin"/);
  assert.match(source, /<Link href=\{`\/\$\{params\.locale\}\/admin`\}>/);
});

test("AdminShell preserves certificate ordering and scopes Activity Center for event managers", () => {
  const source = read("apps/passport-web/components/admin-shell.tsx");
  const certificateHrefs = [...source.matchAll(/href: `\$\{prefix\}(\/admin\/certificates(?:\/(?:records|issue|applications|categories|templates|rules|audit-logs))?)`/g)].map((match) => match[1]);
  assert.deepEqual(certificateHrefs, ["/admin/certificates", "/admin/certificates", "/admin/certificates/records", "/admin/certificates/issue", "/admin/certificates/applications", "/admin/certificates/categories", "/admin/certificates/templates", "/admin/certificates/rules", "/admin/certificates/audit-logs"]);
  for (const href of ["activities/rewards", "activities/certificates", "activities/form-templates", "activity-organizers"]) {
    const itemStart = source.indexOf(`href: \`${"${prefix}"}/admin/${href}\``);
    const nextItemStart = source.indexOf("href:", itemStart + 1);
    assert.notEqual(itemStart, -1, `${href} menu item exists`);
    assert.match(source.slice(itemStart, nextItemStart), /roles: \["ADMIN"\]/);
  }
  assert.match(source, /href: `\$\{prefix\}\/admin\/activities-checkin`[\s\S]*?roles: \["ADMIN", "EVENT_MANAGER"\]/);
  assert.match(source, /href: `\$\{prefix\}\/admin\/summer-school\/applications`[\s\S]*?roles: \["ADMIN"\]/);
});

test("localized admin routes receive exactly the shared layout shell", () => {
  const source = read("apps/passport-web/app/[locale]/admin/layout.tsx");
  assert.match(source, /<AdminShell locale=\{params\.locale\} userRole=\{user\.role\}>/);
  assert.equal((source.match(/<AdminShell/g) ?? []).length, 1);
});
