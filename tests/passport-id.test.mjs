import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadPassportIdModule() {
  const sourcePath = path.resolve("packages/passport-core/src/passport-id.ts");
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
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

function loadChannelBridgeModule() {
  const sourcePath = path.resolve("packages/passport-core/src/channel-bridge.ts");
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

function loadQrTokenModule() {
  const sourcePath = path.resolve("packages/passport-core/src/qr-token.ts");
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
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const {
  PASSPORT_ID_ALPHABET,
  allocateClimatePassportId,
  buildClimatePassportId,
  generateClimatePassportIdCandidate,
  isClimatePassportId,
} = loadPassportIdModule();
const { sanitizeChannelBridgeTargetPath } = loadChannelBridgeModule();
const { createCertificateVerificationCode, hashOpaqueToken, maskPassportId } = loadQrTokenModule();

test("Passport ID alphabet excludes ambiguous characters", () => {
  assert.equal(PASSPORT_ID_ALPHABET.includes("I"), false);
  assert.equal(PASSPORT_ID_ALPHABET.includes("L"), false);
  assert.equal(PASSPORT_ID_ALPHABET.includes("O"), false);
  assert.equal(PASSPORT_ID_ALPHABET.includes("U"), false);
});

test("buildClimatePassportId canonicalizes valid body", () => {
  assert.equal(buildClimatePassportId("k7m9qf2t8n4pz"), "K7M9QF2-T8N4PZ");
});

test("isClimatePassportId accepts final public format only", () => {
  assert.equal(isClimatePassportId("K7M9QF2-T8N4PZ"), true);
  assert.equal(isClimatePassportId("CP-2026-000001"), false);
  assert.equal(isClimatePassportId("K7M9QF2-T8N4PU"), false);
  assert.equal(isClimatePassportId("K7M9QF2T8N4PZ"), false);
});

test("generateClimatePassportIdCandidate uses final format", () => {
  const candidate = generateClimatePassportIdCandidate((length) => new Uint8Array(length).fill(31));
  assert.equal(candidate, "ZZZZZZZ-ZZZZZZ");
});

test("allocateClimatePassportId retries collisions", async () => {
  const first = new Uint8Array(13).fill(1);
  const second = new Uint8Array(13).fill(2);
  const byteSets = [first, second];
  const candidate = await allocateClimatePassportId(
    async (value) => value === "1111111-111111",
    {
      randomBytes: () => byteSets.shift() ?? second,
    },
  );

  assert.equal(candidate, "2222222-222222");
});

test("sanitizeChannelBridgeTargetPath keeps allowlisted local paths", () => {
  assert.equal(
    sanitizeChannelBridgeTargetPath("/en/dashboard?tab=passport#card"),
    "/en/dashboard?tab=passport#card",
  );
  assert.equal(sanitizeChannelBridgeTargetPath("/shcw/home", ["/shcw"]), "/shcw/home");
});

test("sanitizeChannelBridgeTargetPath rejects unsafe or non-allowlisted paths", () => {
  assert.equal(sanitizeChannelBridgeTargetPath("https://evil.example/en"), null);
  assert.equal(sanitizeChannelBridgeTargetPath("//evil.example/en"), null);
  assert.equal(sanitizeChannelBridgeTargetPath("/admin/certificates"), null);
  assert.equal(sanitizeChannelBridgeTargetPath("/en\\evil"), null);
});

test("QR token helpers hash and mask public values", () => {
  assert.equal(hashOpaqueToken("abc"), hashOpaqueToken("abc"));
  assert.notEqual(hashOpaqueToken("abc"), "abc");
  assert.match(createCertificateVerificationCode(), /^CV-[0-9A-Z_-]+$/);
  assert.equal(maskPassportId("K7M9QF2-T8N4PZ"), "K7••••4PZ");
});
