import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function loadRedirectPathModule() {
  const sourcePath = path.resolve("apps/passport-web/lib/redirect-path.ts");
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
    URL,
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const { optionalLocalRedirectPath, sanitizeLocalRedirectPath } = loadRedirectPathModule();

test("sanitizeLocalRedirectPath keeps local application paths", () => {
  assert.equal(sanitizeLocalRedirectPath("/en/dashboard?tab=certs#latest", "/fallback"), "/en/dashboard?tab=certs#latest");
});

test("sanitizeLocalRedirectPath rejects external and ambiguous paths", () => {
  assert.equal(sanitizeLocalRedirectPath("https://evil.example", "/fallback"), "/fallback");
  assert.equal(sanitizeLocalRedirectPath("//evil.example/path", "/fallback"), "/fallback");
  assert.equal(sanitizeLocalRedirectPath("/%2fevil.example/path", "/fallback"), "/fallback");
  assert.equal(sanitizeLocalRedirectPath("/\\evil.example", "/fallback"), "/fallback");
});

test("optionalLocalRedirectPath returns null for unsafe or empty values", () => {
  assert.equal(optionalLocalRedirectPath(""), null);
  assert.equal(optionalLocalRedirectPath("https://evil.example"), null);
  assert.equal(optionalLocalRedirectPath("/en/dashboard"), "/en/dashboard");
});
