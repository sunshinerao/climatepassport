import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const routes = [
  "auth/register", "auth/login", "auth/forgot-password", "auth/reset-password", "auth/verify-email/request", "auth/verify-email/confirm",
  "channel/session/bridge", "channel/session/exchange", "qr/identity", "qr/event-checkin", "verifier/scan", "certificates/verify/[code]", "verify/badge/[token]",
  "admin/invitations/[id]/qr", "admin/invitations/[id]/qr/revoke", "admin/special-passes/[id]/qr", "admin/special-passes/[id]/qr/revoke",
];
test("critical routes use the async shared-aware limiter", async () => {
  for (const route of routes) {
    const source = await readFile(new URL(`../apps/passport-web/app/api/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /checkRateLimitAsync/);
  }
});
test("sensitive mutation routes fail closed and request sensitive distributed protection", async () => {
  for (const route of routes.filter((route) => !route.includes("certificates/verify") && !route.includes("verify/badge"))) {
    const source = await readFile(new URL(`../apps/passport-web/app/api/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /sensitive:\s*true/);
    assert.match(source, /rateLimit\.unavailable[\s\S]{0,160}status:\s*503/);
  }
});
test("email-partitioned auth limiter keys use opaque subject references", async () => {
  for (const route of ["auth/register", "auth/login", "auth/forgot-password", "auth/reset-password", "auth/verify-email/request"]) {
    const source = await readFile(new URL(`../apps/passport-web/app/api/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /getRateLimitSubjectReference\(normalizedEmail\)/);
    assert.doesNotMatch(source, /getRequestRateLimitKey\([^\n]+\):\$\{normalizedEmail\}/);
  }
});
