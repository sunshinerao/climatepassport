import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isBcryptLike, isValidBcryptHash } from "../scripts/password-verifier.mjs";
import {
  BCRYPT_COST,
  classifyPassword,
  configureMigrationEnvironment,
  formatUserIdentifier,
  getTargetDatabaseUrl,
  hashLegacyPassword,
  loadMissingEnvFromFile,
  migrateLegacyPasswords,
  parseEnvContent,
  resolveRepoRoot,
} from "../scripts/migrate-legacy-password-hashes.mjs";

const mockBcryptHash = "$2a$10$" + "a".repeat(53);

function expectedUserRef(id) {
  const rawId = id ?? "";
  const digest = crypto.createHash("sha256").update(String(rawId)).digest("hex");
  return `userRef=${digest.slice(0, 12)}`;
}

function buildFakePrisma(conflictingIds = new Set()) {
  const updates = [];

  return {
    updates,
    user: {
      updateMany: async ({ where, data }) => {
        updates.push({ where, data });
        const count = conflictingIds.has(where.id) ? 0 : 1;
        return { count };
      },
    },
  };
}

test("formatUserIdentifier returns an opaque truncated SHA-256 reference derived from user.id", () => {
  const withEmail = formatUserIdentifier({ id: "u1", email: "a@example.com" });
  assert.equal(withEmail, expectedUserRef("u1"));
  assert.ok(!withEmail.includes("@"));
  assert.ok(!withEmail.includes("example.com"));

  assert.equal(formatUserIdentifier({ id: "u1" }), expectedUserRef("u1"));
  assert.equal(formatUserIdentifier({}), expectedUserRef(""));
});

test("formatUserIdentifier never exposes password or hash values", () => {
  const identifier = formatUserIdentifier({
    id: "u1",
    email: "a@example.com",
    password: "secret-plaintext",
  });
  assert.ok(!identifier.includes("secret"));
  assert.ok(!identifier.includes("plaintext"));
  assert.ok(!identifier.includes("$2a$"));
});

test("classifyPassword distinguishes bcrypt, legacy, blank, and malformed bcrypt values", async () => {
  const bcryptHash = await hash("secret", BCRYPT_COST);
  assert.equal(classifyPassword({ password: bcryptHash }).status, "bcrypt");
  assert.equal(classifyPassword({ password: "plaintext" }).status, "legacy");
  assert.equal(classifyPassword({ password: "seeded-password" }).status, "legacy");
  assert.equal(classifyPassword({ password: "$2a$10$truncated" }).status, "invalid");
  assert.equal(classifyPassword({ password: "$2b$10$short" }).status, "invalid");
  assert.equal(classifyPassword({ password: "$2y$10$" }).status, "invalid");
  assert.equal(classifyPassword({ password: "$2" }).status, "invalid");
  assert.equal(
    classifyPassword({
      password: "$2x$10$abcdefghijklmnopqrstuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    }).status,
    "invalid",
  );
  assert.ok(isBcryptLike("$2x$10$abcdefghijklmnopqrstuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"));
  assert.equal(classifyPassword({ password: "" }).status, "blank");
  assert.equal(classifyPassword({ password: "   " }).status, "blank");
  assert.equal(classifyPassword({ password: null }).status, "blank");
  assert.equal(classifyPassword({ password: undefined }).status, "blank");
});

test("migrateLegacyPasswords dry-run reports legacy, blank, and malformed bcrypt rows without hashing", async () => {
  const bcryptHash = await hash("secret", BCRYPT_COST);
  const users = [
    { id: "u1", email: "ok@example.com", password: bcryptHash },
    { id: "u2", email: "legacy@example.com", password: "plaintext" },
    { id: "u3", email: "blank@example.com", password: "" },
    { id: "u4", email: "malformed@example.com", password: "$2a$10$truncated" },
  ];

  const fakePrisma = buildFakePrisma();
  const summary = await migrateLegacyPasswords(users, { prisma: fakePrisma });

  assert.equal(summary.total, 4);
  assert.equal(summary.bcrypt, 1);
  assert.equal(summary.legacy, 1);
  assert.equal(summary.blank, 1);
  assert.equal(summary.invalid, 1);
  assert.equal(summary.migrated, 0);
  assert.equal(fakePrisma.updates.length, 0);
  assert.equal(summary.issues.length, 3);

  for (const issue of summary.issues) {
    assert.ok(issue.identifier.startsWith("userRef="), "identifier should be opaque userRef");
    assert.ok(!issue.identifier.includes("@"), "identifier must not contain email");
    assert.ok(!issue.identifier.includes("plaintext"), "identifier must not contain password");
    assert.ok(!issue.identifier.includes("$2a$"), "identifier must not contain hash");
  }

  const reasons = summary.issues.map((issue) => issue.reason);
  assert.ok(reasons.includes("blank"));
  assert.ok(reasons.includes("legacy"));
  assert.ok(reasons.includes("invalid/malformed"));
});

test("migrateLegacyPasswords apply hashes normal legacy plaintext values with conditional updateMany", async () => {
  const users = [
    { id: "u1", email: "legacy@example.com", password: "seeded-password" },
  ];

  const fakePrisma = buildFakePrisma();
  const summary = await migrateLegacyPasswords(users, {
    apply: true,
    prisma: fakePrisma,
    hashFn: async () => mockBcryptHash,
  });

  assert.equal(summary.legacy, 1);
  assert.equal(summary.migrated, 1);
  assert.equal(summary.conflicts, 0);
  assert.equal(fakePrisma.updates.length, 1);
  assert.equal(fakePrisma.updates[0].where.id, "u1");
  assert.equal(fakePrisma.updates[0].where.password, "seeded-password");
  assert.ok(isValidBcryptHash(fakePrisma.updates[0].data.password));
});

test("migrateLegacyPasswords apply reports conflicts for zero-row conditional updates", async () => {
  const users = [{ id: "u1", email: "conflict@example.com", password: "plaintext" }];
  const fakePrisma = buildFakePrisma(new Set(["u1"]));

  const summary = await migrateLegacyPasswords(users, {
    apply: true,
    prisma: fakePrisma,
    hashFn: async () => mockBcryptHash,
  });

  assert.equal(summary.migrated, 0);
  assert.equal(summary.conflicts, 1);
  assert.equal(fakePrisma.updates.length, 1);
});

test("migrateLegacyPasswords apply does not hash blank values", async () => {
  const users = [{ id: "u1", email: "blank@example.com", password: "" }];
  const fakePrisma = buildFakePrisma();

  const summary = await migrateLegacyPasswords(users, {
    apply: true,
    prisma: fakePrisma,
    hashFn: async () => {
      throw new Error("hashFn should not be called for blank passwords");
    },
  });

  assert.equal(summary.blank, 1);
  assert.equal(summary.legacy, 0);
  assert.equal(summary.migrated, 0);
  assert.equal(fakePrisma.updates.length, 0);
});

test("migrateLegacyPasswords apply does not hash malformed bcrypt-like values", async () => {
  const users = [{ id: "u1", email: "malformed@example.com", password: "$2a$10$truncated" }];
  const fakePrisma = buildFakePrisma();

  const summary = await migrateLegacyPasswords(users, {
    apply: true,
    prisma: fakePrisma,
    hashFn: async () => {
      throw new Error("hashFn should not be called for malformed bcrypt values");
    },
  });

  assert.equal(summary.invalid, 1);
  assert.equal(summary.legacy, 0);
  assert.equal(summary.migrated, 0);
  assert.equal(fakePrisma.updates.length, 0);
  assert.equal(summary.issues[0].reason, "invalid/malformed");
});

test("hashLegacyPassword produces a valid bcrypt hash at cost 10", async () => {
  const result = await hashLegacyPassword("legacy-password");
  assert.match(result, /^\$2[aby]\$10\$/);
  assert.equal(result.length, 60);
});

test("env loading helpers", async (t) => {
  const originalClimateUrl = process.env.CLIMATE_PASSPORT_DATABASE_URL;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  t.after(() => {
    if (originalClimateUrl === undefined) {
      delete process.env.CLIMATE_PASSPORT_DATABASE_URL;
    } else {
      process.env.CLIMATE_PASSPORT_DATABASE_URL = originalClimateUrl;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  await t.test("parseEnvContent parses KEY=value lines with optional quotes and ignores comments/blank lines", () => {
    const content = `
# Comment
DATABASE_URL="postgresql://localhost/db"
DIRECT_URL='postgresql://localhost/db2'
UNQUOTED=value
BLANK=
# Another comment
WITH_EQUALS=a=b=c
`;
    const parsed = parseEnvContent(content);
    assert.equal(parsed.DATABASE_URL, "postgresql://localhost/db");
    assert.equal(parsed.DIRECT_URL, "postgresql://localhost/db2");
    assert.equal(parsed.UNQUOTED, "value");
    assert.equal(parsed.BLANK, "");
    assert.equal(parsed.WITH_EQUALS, "a=b=c");
    assert.equal(parsed.COMMENT, undefined);
  });

  await t.test("loadMissingEnvFromFile loads only missing keys and never overwrites existing env vars", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "migrate-env-test-"));
    const envFile = path.join(tempDir, ".env");
    fs.writeFileSync(
      envFile,
      'CLIMATE_PASSPORT_DATABASE_URL="from-file-climate"\nDATABASE_URL="from-file-database"\nOTHER_KEY=other\n',
    );

    process.env.CLIMATE_PASSPORT_DATABASE_URL = "existing-climate";
    delete process.env.DATABASE_URL;

    const loaded = loadMissingEnvFromFile(envFile, [
      "CLIMATE_PASSPORT_DATABASE_URL",
      "DATABASE_URL",
    ]);

    try {
      assert.equal(process.env.CLIMATE_PASSPORT_DATABASE_URL, "existing-climate");
      assert.equal(process.env.DATABASE_URL, "from-file-database");
      assert.deepEqual(loaded, { DATABASE_URL: "from-file-database" });
      assert.equal(loaded.CLIMATE_PASSPORT_DATABASE_URL, undefined);
      assert.equal(process.env.OTHER_KEY, undefined);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await t.test("getTargetDatabaseUrl prefers CLIMATE_PASSPORT_DATABASE_URL then DATABASE_URL", () => {
    process.env.CLIMATE_PASSPORT_DATABASE_URL = "climate-url";
    process.env.DATABASE_URL = "database-url";
    assert.equal(getTargetDatabaseUrl(), "climate-url");

    delete process.env.CLIMATE_PASSPORT_DATABASE_URL;
    assert.equal(getTargetDatabaseUrl(), "database-url");

    delete process.env.DATABASE_URL;
    assert.equal(getTargetDatabaseUrl(), undefined);
  });

  await t.test("resolveRepoRoot points at the repository root", () => {
    const repoRoot = resolveRepoRoot();
    assert.ok(fs.existsSync(path.join(repoRoot, "package.json")));
  });

  await t.test("configureMigrationEnvironment loads missing database URL variables from repo root .env", () => {
    delete process.env.CLIMATE_PASSPORT_DATABASE_URL;
    delete process.env.DATABASE_URL;

    configureMigrationEnvironment();

    assert.ok(process.env.CLIMATE_PASSPORT_DATABASE_URL);
    assert.ok(process.env.DATABASE_URL);
  });
});
