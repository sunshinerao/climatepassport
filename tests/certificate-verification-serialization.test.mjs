import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function transpileModule(sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function loadQrTokenModule() {
  const sourcePath = path.resolve("packages/passport-core/src/qr-token.ts");
  const compiled = transpileModule(sourcePath);
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require,
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

function loadCertificatesModule(passportCoreStub) {
  const sourcePath = path.resolve("apps/passport-web/lib/server/certificates.ts");
  const compiled = transpileModule(sourcePath);

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (moduleName) => {
      if (moduleName === "@climate-passport/passport-core") {
        return passportCoreStub;
      }
      return require(moduleName);
    },
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const passportCoreStub = loadQrTokenModule();
const {
  allocateCertificateVerificationCode,
  serializePublicCertificateVerification,
} = loadCertificatesModule(passportCoreStub);

test("allocateCertificateVerificationCode retries collisions", async () => {
  const allocated = await allocateCertificateVerificationCode(async (candidate) => candidate === "CV-COLLISION");
  assert.equal(typeof allocated, "string");
  assert.equal(allocated.startsWith("CV-"), true);
  assert.notEqual(allocated, "CV-COLLISION");
});

test("serializePublicCertificateVerification maps issued status to VALID", () => {
  const payload = serializePublicCertificateVerification({
    id: "cert-1",
    status: "ISSUED",
    verificationCode: "CV-ABC123",
    issuedAt: new Date("2026-05-23T00:00:00.000Z"),
    generatedFileName: "certificate.pdf",
    user: {
      name: "Alice",
      climatePassportId: "K7M9QF2-T8N4PZ",
    },
    definition: {
      name: "Program Completion",
      nameEn: "Program Completion",
      verificationMode: "PUBLIC_CODE",
      category: {
        name: "Learning",
        nameEn: "Learning",
      },
    },
  });

  assert.equal(payload.valid, true);
  assert.equal(payload.result, "VALID");
  assert.equal(payload.certificate.holderName, "Alice");
  assert.equal(payload.certificate.maskedPassportId, "K7••••4PZ");
  assert.equal(payload.certificate.certificateNumber, "CV-ABC123");
  assert.equal(typeof payload.certificate.verifiedAt, "string");
  assert.equal(Number.isNaN(Date.parse(payload.certificate.verifiedAt)), false);
});

test("serializePublicCertificateVerification maps revoked status to REVOKED", () => {
  const payload = serializePublicCertificateVerification({
    id: "cert-2",
    status: "REVOKED",
    verificationCode: "CV-DEF456",
    issuedAt: null,
    generatedFileName: null,
    user: {
      name: "Bob",
      climatePassportId: "ABCD123-XYZ987",
    },
    definition: {
      name: "Attendance",
      nameEn: null,
      verificationMode: "PUBLIC_CODE",
      category: {
        name: "Event",
        nameEn: null,
      },
    },
  });

  assert.equal(payload.valid, false);
  assert.equal(payload.result, "REVOKED");
  assert.equal(payload.certificate.issuedAt, null);
});

test("serializePublicCertificateVerification keeps minimum-disclosure structure", () => {
  const payload = serializePublicCertificateVerification({
    id: "cert-3",
    status: "APPROVED",
    verificationCode: "CV-XYZ999",
    issuedAt: null,
    generatedFileName: null,
    user: {
      name: "Carol",
      climatePassportId: null,
    },
    definition: {
      name: "Role Contribution",
      nameEn: "Role Contribution",
      verificationMode: "PUBLIC_CODE",
      category: {
        name: "Contribution",
        nameEn: "Contribution",
      },
    },
  });

  assert.equal(payload.result, "INVALID");
  assert.equal(Object.prototype.hasOwnProperty.call(payload.certificate, "email"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload.certificate, "phone"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload.certificate, "adminNotes"), false);
});
