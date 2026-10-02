import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { hash } from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { isBcryptLike, isValidBcryptHash, verifyBcryptPassword } from "../scripts/password-verifier.mjs";

const require = createRequire(import.meta.url);

function loadAuthModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/auth.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require,
    console,
    Buffer,
  };

  const baseRequire = sandbox.require;
  sandbox.require = (id) => {
    if (id === "next/headers") {
      return {
        cookies: () => ({
          get: () => undefined,
          set: () => {},
          delete: () => {},
        }),
      };
    }

    if (id === "next/navigation") {
      return {
        redirect: () => {
          throw new Error("redirect");
        },
      };
    }

    if (id === "@climate-passport/passport-core") {
      return {
        allocateClimatePassportId: async () => "",
        sanitizeChannelBridgeTargetPath: (value) => value,
      };
    }

    if (id === "@/lib/site-content") {
      return {};
    }

    if (id === "@/lib/server/prisma") {
      return { getPrismaClient: () => null };
    }

    if (id === "@/lib/server/audit") {
      return { writeCoreAuditLog: async () => {} };
    }

    return baseRequire(id);
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const { verifyUserPassword } = loadAuthModule();

test("isValidBcryptHash accepts full bcrypt verifiers", () => {
  const body = "10$" + "a".repeat(53);
  assert.equal(isValidBcryptHash("$2a$" + body), true);
  assert.equal(isValidBcryptHash("$2b$" + body), true);
  assert.equal(isValidBcryptHash("$2y$" + body), true);
});

test("isValidBcryptHash rejects malformed or non-bcrypt strings", () => {
  assert.equal(isValidBcryptHash("plaintext"), false);
  assert.equal(isValidBcryptHash("$2a$10$short"), false);
  assert.equal(isValidBcryptHash("$2x$10$abcdefghijklmnopqrstuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"), false);
  assert.equal(isValidBcryptHash("$2a$10$abcdefghijklmnopqrstuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx!"), false);
  assert.equal(isValidBcryptHash(""), false);
  assert.equal(isValidBcryptHash(null), false);
  assert.equal(isValidBcryptHash(undefined), false);
});

test("isBcryptLike detects strings that begin with the bcrypt modular crypt prefix", () => {
  assert.equal(isBcryptLike("$2a$10$" + "a".repeat(53)), true);
  assert.equal(isBcryptLike("$2b$10$short"), true);
  assert.equal(isBcryptLike("$2y$"), true);
  assert.equal(isBcryptLike("$2"), true);
  assert.equal(isBcryptLike("$2x$10$abcdefghijklmnopqrstuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"), true);
});

test("isBcryptLike rejects strings that do not look like bcrypt attempts", () => {
  assert.equal(isBcryptLike("plaintext"), false);
  assert.equal(isBcryptLike("seeded-password"), false);
  assert.equal(isBcryptLike(""), false);
  assert.equal(isBcryptLike(null), false);
  assert.equal(isBcryptLike(undefined), false);
});

test("verifyUserPassword accepts correct bcrypt password", async () => {
  const passwordHash = await hash("correct-horse-battery-staple", 10);
  assert.equal(await verifyUserPassword(passwordHash, "correct-horse-battery-staple"), true);
});

test("verifyUserPassword rejects wrong bcrypt password", async () => {
  const passwordHash = await hash("correct-horse-battery-staple", 10);
  assert.equal(await verifyUserPassword(passwordHash, "wrong-password"), false);
});

test("verifyUserPassword rejects plaintext and malformed stored passwords without throwing", async () => {
  assert.equal(await verifyUserPassword("plaintext", "plaintext"), false);
  assert.equal(await verifyUserPassword("$2a$10$truncated", "x"), false);
  assert.equal(await verifyUserPassword("", ""), false);
  await assert.doesNotReject(async () => verifyUserPassword("not-a-hash", "x"));
});

test("verifyBcryptPassword helper behaves consistently with auth verifier", async () => {
  const passwordHash = await hash("shared-secret", 10);
  assert.equal(await verifyBcryptPassword(passwordHash, "shared-secret"), true);
  assert.equal(await verifyBcryptPassword(passwordHash, "other-secret"), false);
  assert.equal(await verifyBcryptPassword("plaintext", "shared-secret"), false);
});
