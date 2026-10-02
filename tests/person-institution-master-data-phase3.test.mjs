import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const walkRouteFiles = (dir) => {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkRouteFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
};

test("Phase 3 schema contains Person, Affiliation, RoleProfile, and compatibility fields only additively", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /enum PersonVerificationStatus \{/);
  assert.match(schema, /enum PersonAffiliationStatus \{/);
  assert.match(schema, /enum PersonRoleType \{/);
  assert.match(schema, /enum InstitutionVerificationStatus \{/);
  assert.match(schema, /model Person \{/);
  assert.match(schema, /model PersonAffiliation \{/);
  assert.match(schema, /model PersonRoleProfile \{/);
  assert.match(schema, /personId\s+String\?/);
  assert.match(schema, /person\s+Person\?\s+@relation\(fields:\s*\[personId\]/);
  assert.match(schema, /verificationStatus\s+InstitutionVerificationStatus\s+@default\(UNVERIFIED\)/);
  assert.match(schema, /parentInstitutionId\s+String\?/);
  assert.match(schema, /aliases\s+String\[\]/);
  assert.doesNotMatch(schema, /DROP\s+TABLE/i);
  assert.doesNotMatch(schema, /RENAME\s+(TABLE|COLUMN)/i);
});

test("Phase 3 migration is additive and contains no destructive statements", () => {
  const migrationPath = "prisma/migrations/20260913070000_person_institution_master_data_phase3/migration.sql";
  assert.ok(exists(migrationPath), "Migration file exists");
  const sql = read(migrationPath);
  assert.match(sql, /CREATE TYPE "PersonVerificationStatus"/);
  assert.match(sql, /CREATE TABLE "people"/);
  assert.match(sql, /ALTER TABLE "speakers"\s+ADD COLUMN "personId" TEXT/s);
  assert.match(sql, /ALTER TABLE "institutions"/s);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|TYPE|COLUMN|INDEX)/i);
  assert.doesNotMatch(sql, /RENAME\s+(TABLE|COLUMN|TO)/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM/i);
});

function stripLineComments(source) {
  return source
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("backfill script defaults to dry-run, reports opaque ids, and performs zero writes in dry-run", async () => {
  const script = read("scripts/backfill-speaker-persons.mjs");
  assert.match(script, /const APPLY = process\.argv\.includes\("--apply"\)/);
  assert.match(script, /const DRY_RUN = !APPLY/);
  assert.match(script, /mode: "dry-run"/);
  assert.match(script, /Zero database writes occurred/i);
  // No fuzzy or User/Institution/Organization matching logic in code (comments are allowed).
  const codeOnly = stripLineComments(script);
  assert.equal(/\bfuzzy\b/.test(codeOnly), false);
  assert.equal(/User\s*\.\s*find|Institution\s*\.\s*find|Organization\s*\.\s*find/i.test(codeOnly), false);

  // Execute the original default CLI branch with a synthetic client. Every write
  // method throws, so the zero-write assertion checks behavior, not just a report.
  const rows = [{ id: "speaker-synthetic-private-id" }];
  let queries = 0;
  let disconnects = 0;
  let writes = 0;
  const logs = [];
  const errors = [];
  const forbiddenWrite = () => { writes += 1; throw new Error("dry-run attempted a write"); };
  class SyntheticPrisma {
    speaker = {
      findMany: async (query) => {
        assert.equal(query.where.personId, null);
        assert.equal(query.orderBy.createdAt, "asc");
        queries += 1;
        return rows;
      },
      update: forbiddenWrite,
    };
    person = { create: forbiddenWrite };
    personRoleProfile = { create: forbiddenWrite };
    $transaction = forbiddenWrite;
    $disconnect = async () => { disconnects += 1; };
  }
  const runnable = script
    .replace(/^#!.*\n/, "")
    .replace(/^import .*;\n/gm, "");
  vm.runInNewContext(runnable, {
    fs: { existsSync: () => { throw new Error("fixture must not read env files"); } },
    path,
    PrismaClient: SyntheticPrisma,
    process: {
      argv: ["node", "backfill-speaker-persons.mjs"],
      env: { DATABASE_URL: "postgresql://fixture@127.0.0.1:55432/synthetic_backfill" },
      exit: () => { throw new Error("unexpected process exit"); },
    },
    console: { log: (line) => logs.push(line), error: (line) => errors.push(line) },
    setTimeout,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(errors, []);
  assert.equal(queries, 1);
  assert.equal(disconnects, 1);
  assert.equal(writes, 0);
  assert.equal(logs.length, 1);
  const report = JSON.parse(logs[0]);
  assert.equal(report.unlinkedCount, rows.length);
  assert.equal(report.wouldCreatePeople, rows.length);
  assert.equal(report.wouldCreateRoleProfiles, rows.length);
  assert.equal(report.wouldLinkSpeakers, rows.length);
  assert.ok(!logs[0].includes(rows[0].id), "report hides complete speaker ids");
  assert.equal(report.mode, "dry-run");
  assert.equal(report.writes, 0);
  assert.ok(typeof report.unlinkedCount === "number");
});

test("new people/institution APIs are ADMIN-only and validate relationships", () => {
  const adminApiRoot = path.join(root, "apps/passport-web/app/api/admin");
  const files = [
    "people/route.ts",
    "people/[id]/route.ts",
    "people/[id]/affiliations/route.ts",
    "people/[id]/role-profiles/route.ts",
    "institutions/route.ts",
    "institutions/[id]/route.ts",
    "institutions/[id]/governance/route.ts",
    "speakers/route.ts",
    "speakers/unlinked/route.ts",
    "speakers/[id]/person/route.ts",
  ];

  for (const file of files) {
    const source = read(path.join("apps/passport-web/app/api/admin", file));
    assert.match(
      source,
      /requireApiRole\(\["ADMIN"\](,\s*\w+)?\)/,
      `${file} enforces ADMIN-only access`,
    );
    assert.match(source, /getPrismaClient\(\)/, `${file} uses Prisma client`);
  }

  const link = read("apps/passport-web/app/api/admin/speakers/[id]/person/route.ts");
  const linkSchema = read("apps/passport-web/lib/server/people-master-data.ts");
  assert.match(link, /PATCH[\s\S]*DELETE/);
  assert.match(link, /speakerLinkSchema\.safeParse/);
  assert.match(linkSchema, /speakerLinkSchema = z\.object\(\{\s*personId: z\.string\(\)\.trim\(\)\.uuid\(\)/);
  assert.match(link, /SPEAKER_LINK_PERSON/);
  assert.match(link, /SPEAKER_UNLINK_PERSON/);
});

test("admin pages for People and Institutions require ADMIN role", () => {
  const peoplePage = read("apps/passport-web/app/[locale]/admin/people/page.tsx");
  const institutionsPage = read("apps/passport-web/app/[locale]/admin/institutions/page.tsx");
  assert.match(peoplePage, /requireRoleAccess\(params\.locale, \["ADMIN"\], `\/\$\{params\.locale\}\/admin\/people`\)/);
  assert.match(institutionsPage, /requireRoleAccess\(params\.locale, \["ADMIN"\], `\/\$\{params\.locale\}\/admin\/institutions`\)/);
});

test("AdminShell adds People and Institutions module scoped to ADMIN only", () => {
  const shell = read("apps/passport-web/components/admin-shell.tsx");
  const moduleStart = shell.indexOf('href: `${prefix}/admin/people`');
  assert.notEqual(moduleStart, -1, "People module exists");
  const nextItemStart = shell.indexOf("href:", moduleStart + 1);
  assert.match(shell.slice(moduleStart, nextItemStart), /roles: \["ADMIN"\]/);
  assert.match(shell, /href: `\$\{prefix\}\/admin\/institutions`/);
});

test("no recruitment, matching, partner-search, or public directory endpoints were added", () => {
  const apiRoot = path.join(root, "apps/passport-web/app/api");
  const publicRoot = path.join(root, "apps/passport-web/app/[locale]");
  const files = [...walkRouteFiles(apiRoot), ...walkRouteFiles(publicRoot)];
  const forbidden = /recruitment|matching|partner-search|talent|public-directory|\/directory/;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(
      forbidden.test(source),
      false,
      `${path.relative(root, file)} must not contain recruitment/matching/directory surfaces`,
    );
  }
});

test("root package scripts expose backfill dry-run and apply commands", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["backfill:speakers:dry-run"], "node scripts/backfill-speaker-persons.mjs");
  assert.equal(pkg.scripts["backfill:speakers:apply"], "node scripts/backfill-speaker-persons.mjs --apply");
});
