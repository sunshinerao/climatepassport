import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadSummerSchoolLookupModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/server/summer-school-lookup.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const sandbox = {
    exports: {},
    module: { exports: {} },
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const {
  isValidApplicationLookupEmail,
  buildSummerSchoolLookupOrFilters,
} = loadSummerSchoolLookupModule();

test("isValidApplicationLookupEmail validates expected email shape", () => {
  assert.equal(isValidApplicationLookupEmail("user@example.com"), true);
  assert.equal(isValidApplicationLookupEmail("  user@example.com"), false);
  assert.equal(isValidApplicationLookupEmail("user@example"), false);
  assert.equal(isValidApplicationLookupEmail(""), false);
});

test("buildSummerSchoolLookupOrFilters builds filters for email-only lookup", () => {
  assert.equal(
    JSON.stringify(buildSummerSchoolLookupOrFilters({ email: "user@example.com" })),
    JSON.stringify([{ email: "user@example.com" }]),
  );
});

test("buildSummerSchoolLookupOrFilters builds filters for passport-only lookup", () => {
  assert.equal(
    JSON.stringify(buildSummerSchoolLookupOrFilters({ passportId: "ABCD123-XYZ987" })),
    JSON.stringify([{ climatePassportId: "ABCD123-XYZ987" }]),
  );
});

test("buildSummerSchoolLookupOrFilters includes both filters when provided", () => {
  assert.equal(
    JSON.stringify(buildSummerSchoolLookupOrFilters({ email: "user@example.com", passportId: "ABCD123-XYZ987" })),
    JSON.stringify([{ email: "user@example.com" }, { climatePassportId: "ABCD123-XYZ987" }]),
  );
});

test("buildSummerSchoolLookupOrFilters returns empty for invalid input", () => {
  assert.equal(JSON.stringify(buildSummerSchoolLookupOrFilters({ email: "invalid-email" })), JSON.stringify([]));
  assert.equal(JSON.stringify(buildSummerSchoolLookupOrFilters({ passportId: "   " })), JSON.stringify([]));
});
