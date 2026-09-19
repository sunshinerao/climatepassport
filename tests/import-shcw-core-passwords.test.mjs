import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { isValidBcryptHash } from "../scripts/password-verifier.mjs";

const importSource = fs.readFileSync("scripts/import-shcw-core.mjs", "utf8");

test("isValidBcryptHash rejects non-bcrypt input", () => {
  assert.equal(isValidBcryptHash("plaintext"), false);
  assert.equal(isValidBcryptHash("$2a$10$tooshort"), false);
});

test("import script validates password hash before persistence", () => {
  assert.ok(importSource.includes('import { isValidBcryptHash } from "./password-verifier.mjs";'));
  assert.ok(importSource.includes("if (!isValidBcryptHash(user.password))"));
});

test("import script error message identifies only non-sensitive source identifiers", () => {
  const throwStart = importSource.indexOf("throw new Error(");
  const throwEnd = importSource.indexOf(");", throwStart);
  const errorMessageBlock = importSource.slice(throwStart, throwEnd + 2);

  assert.match(errorMessageBlock, /formatUserIdentifier\(user\)/);
  assert.equal(errorMessageBlock.includes("user.password"), false);
  assert.equal(errorMessageBlock.includes("password"), true); // word appears in message only
});

test("import script uses validated password in both update and create branches", () => {
  const upsertBlock = importSource.slice(
    importSource.indexOf("async function upsertUsers(users)"),
    importSource.indexOf("async function upsertEvents"),
  );

  const validationIndex = upsertBlock.indexOf("if (!isValidBcryptHash(user.password))");
  const updateFieldIndex = upsertBlock.indexOf("password: user.password", upsertBlock.indexOf("update: {"));
  const createFieldIndex = upsertBlock.indexOf("password: user.password", upsertBlock.indexOf("create: {"));

  assert.notEqual(updateFieldIndex, -1, "update branch must persist user.password");
  assert.notEqual(createFieldIndex, -1, "create branch must persist user.password");
  assert.ok(
    validationIndex < updateFieldIndex && validationIndex < createFieldIndex,
    "validation must precede both persistence branches",
  );
});
