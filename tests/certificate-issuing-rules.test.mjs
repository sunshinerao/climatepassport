import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relative) => fs.readFileSync(path.resolve(relative), "utf8");

test("certificate rule management exposes only truthful supported capabilities", () => {
  const route = read("apps/passport-web/app/api/admin/certificates/rules/route.ts");
  const ui = read("apps/passport-web/components/certificate-admin-prototype.tsx");
  assert.match(route, /z\.literal\("ACTIVITY_CHECKIN"\)/);
  assert.match(route, /conditionsSupported: false/);
  assert.match(route, /COURSE_COMPLETION/);
  assert.match(route, /findFirst[\s\S]*certificateDefinitionId[\s\S]*trigger/);
  assert.match(route, /requiresAdminConfirmation: z\.literal\(false\)/);
  assert.doesNotMatch(ui, /Course Completion Auto-Issue/);
  assert.match(ui, /Course completion \(unavailable\)/);
  assert.match(ui, /No persisted rules/);
});

test("all certificate-rule compatibility entrances converge on the canonical API", () => {
  const legacy = read("apps/passport-web/app/api/activity-certificate-rules/route.ts");
  const scoped = read("apps/passport-web/app/api/activities/[id]/certificate-rules/route.ts");
  for (const source of [legacy, scoped]) {
    assert.match(source, /\/api\/admin\/certificates\/rules/);
    assert.match(source, /307/);
  }
});

test("scanner and issuance worker enforce persisted enablement and supported trigger", () => {
  const scanner = read("apps/passport-web/app/api/verifier/scan/route.ts");
  const worker = read("apps/passport-web/lib/server/activity-checkin-certificate-issuance.ts");
  for (const source of [scanner, worker]) {
    assert.match(source, /ACTIVITY_CHECKIN/);
    assert.match(source, /isActive/);
    assert.match(source, /requiresAdminConfirmation/);
  }
  assert.match(worker, /if \(issuance\.rule\.notifyUser\)/);
});
