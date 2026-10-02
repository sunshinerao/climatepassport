import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const page = read("apps/passport-web/app/[locale]/admin/channel-clients/page.tsx");
const manager = read("apps/passport-web/components/admin-channel-clients-manager.tsx");
const registryRoute = read("apps/passport-web/app/api/admin/channel-clients/route.ts");
const shell = read("apps/passport-web/components/admin-shell.tsx");

test("the channel-client registry page is ADMIN-only behind the shared role guard", () => {
  assert.match(
    page,
    /requireRoleAccess\(params\.locale, \["ADMIN"\], `\/\$\{params\.locale\}\/admin\/channel-clients`\)/,
  );
  assert.doesNotMatch(page, /EVENT_MANAGER/, "machine credentials must not reach event managers");
});

test("the page never queries secret-bearing columns; the safe projection stays in the route", () => {
  assert.doesNotMatch(page, /prisma\.channelClient\./, "the list must come from /api/admin/channel-clients");
  assert.doesNotMatch(page, /machineKeyBcrypt|machineKeyHash/);
  assert.doesNotMatch(manager, /machineKeyBcrypt|machineKeyHash/, "the browser must never receive a digest");
  // The route reads the digest only to strip it before serialization.
  assert.match(registryRoute, /rows\.map\(\(\{ machineKeyHash, \.\.\.client \}\) =>/);
  assert.equal((registryRoute.match(/machineKeyBcrypt/g) ?? []).length, 0, "bcrypt is never even selected");
  assert.match(manager, /fetch\(`\/api\/admin\/channel-clients\?\$\{params\.toString\(\)\}`\)/);
});

test("the list is paginated and filtered server-side, never by loading every row", () => {
  assert.match(registryRoute, /page: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.default\(1\)/);
  assert.match(
    registryRoute,
    /pageSize: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(CLIENT_PAGE_SIZE_MAX\)\.default\(CLIENT_PAGE_SIZE_DEFAULT\)/,
  );
  assert.match(registryRoute, /skip: \(page - 1\) \* pageSize/);
  assert.match(registryRoute, /take: pageSize/);
  assert.match(registryRoute, /prisma\.channelClient\.count\(\{ where \}\)/);
  assert.match(
    registryRoute,
    /pagination: \{ page, pageSize, total, totalPages: Math\.max\(1, Math\.ceil\(total \/ pageSize\)\) \}/,
  );
  // createdAt alone ties on batch inserts, which duplicates or drops rows across pages.
  assert.match(registryRoute, /orderBy: \[\{ createdAt: "desc" \}, \{ id: "asc" \}\]/);
  assert.doesNotMatch(registryRoute, /orderBy: \{ createdAt: "desc" \}/);

  // Searching is a server query, so the keyword field must be validated, not trusted.
  assert.match(registryRoute, /search: z\.string\(\)\.trim\(\)\.max\(CLIENT_SEARCH_MAX_LENGTH\)\.optional\(\)/);
  assert.match(registryRoute, /contains: search, mode: "insensitive"/);
});

test("the list panel drives filters into the query string and pages with previous/next", () => {
  assert.doesNotMatch(manager, /clients\.filter\(/, "filtering the loaded page client-side would hide rows");
  for (const param of [
    'params.set("type", typeFilter)',
    'params.set("programmeId", programmeFilter)',
    'params.set("search", search)',
  ]) {
    assert.ok(manager.includes(param), `${param} has to reach the API, not stay in the browser`);
  }
  assert.match(manager, /new URLSearchParams\(\{ page: String\(page\), pageSize: String\(PAGE_SIZE\) \}\)/);
  assert.match(manager, /\{zh \? `凭据清单 · \$\{total\}` : `Credential list · \$\{total\}`\}/);
  assert.doesNotMatch(manager, /凭据清单 · \$\{clients\.length\}/);
  assert.match(manager, /disabled=\{page <= 1 \|\| loading\}/);
  assert.match(manager, /disabled=\{page >= totalPages \|\| loading\}/);
  // Every query change must go back to page 1, otherwise a filter can land on an empty page.
  assert.match(manager, /function changeFilter\(next: \(\) => void\) \{[\s\S]*?setPage\(1\);/);
});

test("the scope catalog is imported from contracts instead of being copied into the page", () => {
  assert.match(page, /CHANNEL_SCOPE_VALUES/);
  assert.match(page, /scopeCatalog=\{\[\.\.\.CHANNEL_SCOPE_VALUES\]\}/);
  assert.match(manager, /scopeCatalog\.map\(\(scope\) =>/);
  assert.doesNotMatch(manager, /const SCOPES?\s*=\s*\[/, "the component must render the injected catalog, not its own list");
});

test("one-time plaintext is read-only and the rotate path warns about immediate invalidation", () => {
  assert.equal((manager.match(/readOnly/g) ?? []).length, 2, "the Open API credential and the machine key are each echoed once");
  assert.equal((manager.match(/onFocus=\{\(event\) => event\.currentTarget\.select\(\)\}/g) ?? []).length, 2);
  assert.match(manager, /唯一一次以明文出现|only time the secret is shown in plaintext/);
  assert.match(manager, /旧机密当场失效|stops working immediately/);
});

test("revoked clients are read-only and cannot be rotated, revoked again, or re-patched", () => {
  assert.ok((manager.match(/disabled=\{!client\.isActive\}/g) ?? []).length >= 6);
  assert.match(manager, /disabled=\{!client\.isActive \|\| busy\}/);
});

test("policy prompts use the in-app dialog, never a native popup", () => {
  assert.doesNotMatch(manager, /window\.(prompt|confirm|alert)/);
  assert.match(manager, /usePromptDialog\(\)/);
  assert.match(manager, /const reason = await askPrompt\(/);
  // Without this mount the promise never surfaces and both buttons look enabled but do nothing.
  assert.equal((manager.match(/\{promptDialog\}/g) ?? []).length, 1);
  assert.match(manager, /askPrompt=\{askPrompt\}/);
});

test("a quota edit always sends the limit and window as one pair", () => {
  assert.match(manager, /quotaChanged \? \{ rateLimitLimit: .*rateLimitWindowMs: .* \} : \{\}/);
});

test("the ADMIN menu exposes the page under the ADMIN-only system module", () => {
  assert.match(
    shell,
    /href: `\$\{prefix\}\/admin\/system`[\s\S]*?roles: \["ADMIN"\][\s\S]*?\$\{prefix\}\/admin\/channel-clients/,
  );
});
