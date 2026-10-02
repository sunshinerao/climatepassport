import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

export function createNextResponseMock() {
  function NextResponse(body, init) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? "";
    this.headers = init?.headers ?? {};
    // Routes branch on `x instanceof NextResponse`, so helpers must return real
    // instances; `payload` is kept as the alias tests historically assert on.
    this.payload = body;
  }
  NextResponse.json = function (payload, init) {
    return new NextResponse(payload, init);
  };
  NextResponse.redirect = function (url, status) {
    return new NextResponse({ url }, { status: status ?? 307 });
  };
  return NextResponse;
}

function createApiAuthMock(merged) {
  const NextResponse = merged["next/server"].NextResponse;
  const auth = merged["@/lib/server/auth"] ?? {};
  const unauthorized = () => NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const forbidden = () => NextResponse.json({ error: "Forbidden." }, { status: 403 });

  async function resolveUser() {
    if (typeof auth.getCurrentUser === "function") {
      return await auth.getCurrentUser();
    }
    const pageGuard = auth.requireAuthenticatedUser ?? auth.requireRoleAccess;
    if (typeof pageGuard !== "function") {
      return null;
    }
    try {
      return await pageGuard("en", ["ADMIN", "EVENT_MANAGER", "ATTENDEE", "VERIFIER", "ORGANIZATION"], "/");
    } catch (error) {
      if (error?.name === "NEXT_REDIRECT") {
        return null;
      }
      throw error;
    }
  }

  return {
    apiUnauthorized: unauthorized,
    apiForbidden: forbidden,
    requireApiUser: async () => (await resolveUser()) ?? unauthorized(),
    requireApiRole: async (roles) => {
      const user = await resolveUser();
      if (!user) return unauthorized();
      return roles.includes(user.role) ? user : forbidden();
    },
  };
}

export function createDefaultMocks(overrides = {}) {
  const NextResponse = createNextResponseMock();
  const merged = {
    "next/server": { NextResponse },
    "next/navigation": {
      redirect: (url) => {
        const err = new Error(`redirect:${url}`);
        err.name = "NEXT_REDIRECT";
        throw err;
      },
    },
    "next/headers": {
      cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
    },
    "@/lib/site-content": { locales: ["en", "zh", "fr", "de"] },
    "@/lib/server/audit": { getRequestAuditContext: () => ({}), writeCoreAuditLog: async () => null },
    "@/lib/server/achievement-badge": { createAchievementRecord: async () => ({ id: "achievement-1" }) },
    "@climate-passport/passport-core": {
      hashOpaqueToken: (token) => `hash:${token}`,
      createOpaqueToken: () => "opaque-token",
      createCertificateVerificationCode: () => "CV-TEST-001",
      maskPassportId: (id) => (id ? `${id.slice(0, 3)}-****-${id.slice(-4)}` : null),
    },
    "@/lib/server/certificate-verification": {
      resolvePublicCertificateVerification: async () => ({
        httpStatus: 404,
        valid: false,
        result: "NOT_FOUND",
        verificationCode: "CV-000",
        accessLevel: "PUBLIC",
      }),
    },
    "@/lib/server/qr": {
      issueQrToken: async () => ({ token: "qr-token", tokenId: "qr-1", type: "IDENTITY", expiresAt: new Date() }),
      getIdentityQrExpiry: () => new Date(Date.now() + 60_000),
      getEventCheckinQrExpiry: () => new Date(Date.now() + 60_000),
      getInvitationSpecialPassQrExpiry: () => new Date(Date.now() + 60_000),
    },
    "@/lib/server/identity-qr-verification": {
      resolveIdentityQrVerification: async () => ({
        ok: false,
        status: "MISSING_TOKEN",
        httpStatus: 400,
        error: "Missing token.",
      }),
    },
    "@/lib/server/prisma": { getPrismaClient: () => null },
    "@/lib/server/reliable-dispatch": {
      CERTIFICATE_LIFECYCLE_DISPATCH_SCOPE: "dispatch:certificates:lifecycle",
      findDispatchTargets: async () => [],
      enqueueOutboundDispatch: async () => ({ ok: true, id: "dispatch-1", deduplicated: false }),
      processOutboundDispatches: async () => ({ claimed: 0, succeeded: 0, retrying: 0, dead: 0, skipped: 0 }),
      reconcileOutboundDispatch: async () => ({ ok: false, error: "not mocked", status: 500 }),
      requeueDeadDispatch: async () => ({ ok: false, error: "not mocked", status: 500 }),
    },
    "@/lib/server/channel-client-auth": {
      authenticateChannelMachine: async () => ({ ok: false, status: 401, code: "UNKNOWN_CLIENT" }),
      readMachineCredentials: () => null,
    },
    "@/lib/server/verifier-activity": {
      canManageActivity: async () => false,
      canVerifyActivity: async () => false,
      isEmptyCertificateCondition: () => true,
      loadVerifiableActivities: async () => [],
    },
    "@/lib/server/verifier-invitation-special-pass": {
      scanInvitationSpecialPassQr: async () => ({ result: "invalid" }),
    },
    "@/lib/server/activity-rewards": {
      triggerActivityRewards: async () => {},
      syncParticipationToPassport: async () => {},
    },
    "@/lib/server/activity-checkin-certificate-issuance": {
      finalizeActivityCheckinCertificateIssuance: async () => ({ status: "issued" }),
    },
    "@/lib/server/certificate-artifact-storage": {
      decodeLegacyCertificateArtifact: () => null,
      getCertificateArtifact: async () => Buffer.from("<html></html>"),
      storeBuiltCertificateArtifact: async () => ({
        generatedFileName: "cert.html",
        artifactProvider: "local",
        artifactKey: "certificates/test/" + "a".repeat(64) + ".html",
        artifactVersion: "a".repeat(64),
        artifactContentType: "text/html",
        artifactByteSize: 10,
        artifactSha256: "a".repeat(64),
        artifactCreatedAt: new Date(),
        artifactVerifiedAt: new Date(),
        artifactState: "READY",
        artifactFailureReason: null,
      }),
    },
    "@/lib/server/certificate-issuance": {
      normalizeManualVariableValues: (values) => values ?? {},
      issueCertificateToRecipient: async (_prisma, input) => ({
        ok: true,
        email: input.email,
        issueId: "issue-test-1",
        verificationCode: "CV-TEST-001",
        verificationUrl: `${input.verificationUrlBase}/verify/certificate/CV-TEST-001`,
        fileName: "cert.pdf",
        reissued: false,
        recipient: { id: "u-1", name: "A", normalizedEmail: input.email, created: false, climatePassportId: null },
        certificateName: "Cert",
        categoryName: "Cat",
      }),
    },
    "@/lib/server/certificate-snapshot": {
      createCertificateRenderSnapshot: (value) => ({ schemaVersion: 1, ...value }),
      parseCertificateRenderSnapshot: () => null,
      snapshotText: () => null,
    },
    "@/lib/server/certificate-module": {
      parseCertificateRenderConfig: () => ({}),
      buildCertificateArtifactWithQr: async () => ({
        fileName: "cert.html",
        pdfFileName: "cert.pdf",
        mimeType: "text/html",
        html: "<html></html>",
        dataUrl: "data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E",
      }),
      buildCertificatePdfArtifactWithQr: async () => ({
        fileName: "cert.pdf",
        pdfFileName: "cert.pdf",
        mimeType: "application/pdf",
        html: "<html></html>",
        bytes: Buffer.from("%PDF-test"),
      }),
      buildCertificateArtifact: async () => ({
        fileName: "cert.html",
        pdfFileName: "cert.pdf",
        mimeType: "text/html",
        html: "<html></html>",
        dataUrl: "data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E",
      }),
      getCertificateIssueForPublicVerification: async () => null,
      serializeCertificateCard: () => ({}),
      serializePublicHolder: () => ({}),
    },
    "@/lib/server/certificate-variables": {
      buildIssuedCertificateVariableValues: () => ({}),
      extractCapabilityTags: () => [],
      extractLearningHoursFromProgramConfig: () => null,
    },
    "@/lib/server/certificates": {
      allocateCertificateVerificationCode: async () => "CV-TEST-001",
      canDownloadCertificateStatus: (status) => status === "ISSUED",
      canMakeCertificatePublicStatus: (status) => status === "ISSUED",
      canRegenerateCertificateStatus: (status) => status !== "REVOKED",
      canRestoreCertificateStatus: (status) => status === "REVOKED",
      canRevokeCertificateStatus: (status) => status !== "REVOKED",
      getCertificateStatusAfterRegeneration: () => "ISSUED",
      serializePublicCertificateVerification: () => ({}),
    },
    "@/lib/server/passport-user-provisioning": {
      ensurePassportUserByEmail: async () => ({
        id: "u-1",
        email: "a@b.com",
        name: "A",
        role: "ATTENDEE",
        status: "ACTIVE",
        climatePassportId: null,
        created: false,
        normalizedEmail: "a@b.com",
      }),
    },
    ...overrides,
  };

  if (!merged["next/server"]?.NextResponse) {
    merged["next/server"] = { ...merged["next/server"], NextResponse };
  }
  merged["@/lib/server/api-auth"] = overrides["@/lib/server/api-auth"] ?? createApiAuthMock(merged);

  return merged;
}

/** Transpile one TypeScript module into the test realm, resolving its own `@/` imports for real. */
function compileTsModule(sourcePath, mocks, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const sandbox = {
    exports: {},
    module: { exports: {} },
    URL,
    Request,
    Response,
    Headers,
    Date,
    console,
    Buffer,
    crypto,
    setTimeout,
    clearTimeout,
    process,
    TextEncoder,
    TextDecoder,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    require: (id) => {
      if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id];
      if (id.startsWith("@/")) return loadServerModule(id);
      return require(id);
    },
    ...globals,
  };

  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox.module.exports;
}

const serverModuleCache = new Map();

/**
 * Load a `@/lib/...` module under test with its dependency chain intact — for pure server
 * helpers that have no route wrapper, where stubbing the helpers away would prove nothing.
 * Cached because these modules hold no per-test state and each realm re-imports bcryptjs.
 */
export function loadServerModule(specifier) {
  if (!serverModuleCache.has(specifier)) {
    serverModuleCache.set(specifier, compileTsModule(path.resolve("apps/passport-web", `${specifier.slice(2)}.ts`), {}));
  }
  return serverModuleCache.get(specifier);
}

/** Compile `specifier` fresh with per-test mocks; the dependency chain still loads for real. */
export function loadConfiguredServerModule(specifier, mocks) {
  return compileTsModule(path.resolve("apps/passport-web", `${specifier.slice(2)}.ts`), mocks);
}

export function loadRouteModule(sourcePath, moduleMocks = {}, globals = {}) {
  const mocks = createDefaultMocks(moduleMocks);
  return { ...compileTsModule(sourcePath, mocks), ...globals };
}
