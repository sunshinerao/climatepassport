import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { z } from "zod";
import { loadRouteModule, createNextResponseMock } from "./_route-loader.mjs";

const apiRoot = path.resolve("apps/passport-web/app/api");

const allowRateLimit = { allowed: true, unavailable: false };
const denyRateLimit = { allowed: false, unavailable: false, retryAfter: 5_000 };
const unavailableRateLimit = { allowed: false, unavailable: true };

function rateLimitMock(result = allowRateLimit) {
  return {
    checkRateLimitAsync: async () => result,
    getRateLimitHeaders: (r) => (r?.retryAfter ? { "Retry-After": String(Math.ceil(r.retryAfter / 1000)) } : {}),
    getRequestRateLimitKey: (_request, prefix) => `${prefix}:key`,
  };
}

const ChannelKeySchema = z.literal("SHCW");
const ApiErrorSchema = z.object({ error: z.object({ code: z.enum(["UNAUTHENTICATED", "INVALID_REQUEST", "INVALID_BRIDGE_TOKEN", "CHANNEL_DISABLED", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR"]) }) }).strict();
const BridgeIssueRequestSchema = z.object({ channel: ChannelKeySchema, targetPath: z.string().max(2048).optional() }).strict();
const BridgeIssueResponseSchema = z.object({ ok: z.literal(true), bridgeToken: z.object({ token: z.string().min(1), channel: ChannelKeySchema, expiresAt: z.string().datetime(), targetPath: z.string().nullable() }).strict() }).strict();
const BridgeExchangeRequestSchema = z.object({ channel: ChannelKeySchema, token: z.string().min(1).max(1024), locale: z.enum(["en", "zh", "fr", "de"]).default("en") }).strict();
const BridgeExchangeResponseSchema = z.object({ ok: z.literal(true), redirectTo: z.string().startsWith("/") }).strict();
const PublicCertificateStatusSchema = z.enum(["PREVIEW", "NOT_FOUND", "VALID", "REVOKED", "EXPIRED", "INVALID"]);
const PublicCertificateVerificationResponseSchema = z.object({
  status: PublicCertificateStatusSchema,
  valid: z.boolean(),
  verificationCode: z.string(),
  message: z.string().optional(),
  certificate: z.object({
    title: z.string(),
    holderName: z.string(),
    maskedPassportId: z.string().nullable(),
    issuingOrganization: z.string(),
    issuedAt: z.string().nullable(),
    expiryDate: z.string().nullable(),
    credentialType: z.string(),
    certificateNumber: z.string().nullable(),
    verifiedAt: z.string(),
  }).strict().optional(),
}).strict();

function contractMock() {
  return {
    ApiErrorSchema,
    BridgeIssueRequestSchema,
    BridgeIssueResponseSchema,
    BridgeExchangeRequestSchema,
    BridgeExchangeResponseSchema,
    PublicCertificateStatusSchema,
    PublicCertificateVerificationResponseSchema,
  };
}

function coreMock({ enabled = true, prefixes = ["/en", "/zh", "/fr", "/de"] } = {}) {
  return {
    resolveChannelConfig: () => ({ channel: "SHCW", enabled, targetPathPrefixes: prefixes, malformed: false }),
    sanitizeChannelBridgeTargetPath: (targetPath, allowedPrefixes) => {
      if (!targetPath) return null;
      const prefix = allowedPrefixes?.find((p) => targetPath.startsWith(`${p}/`) || targetPath === p);
      return prefix ? targetPath : null;
    },
  };
}

function authMock(overrides = {}) {
  return {
    getCurrentUser: async () => null,
    requireAuthenticatedUser: async () => {
      const err = new Error("redirect:/login");
      err.name = "NEXT_REDIRECT";
      throw err;
    },
    getDashboardPathForRole: (_locale, role) => (role === "ADMIN" || role === "EVENT_MANAGER" ? "/en/admin/events" : "/en/dashboard/climate-passport"),
    issueChannelBridgeToken: async ({ userId, targetPath }) => ({ token: "bridge-token", channel: "SHCW", expiresAt: new Date().toISOString(), targetPath: targetPath ?? null }),
    exchangeChannelBridgeToken: async () => null,
    sanitizeChannelBridgeTargetPath: (targetPath) => targetPath ?? null,
    ...overrides,
  };
}

function baseMocks({ auth = {}, rateLimit = allowRateLimit, core = {}, contracts = contractMock(), extra = {} } = {}) {
  return {
    "next/server": { NextResponse: createNextResponseMock() },
    "@climate-passport/passport-contracts": contracts,
    "@climate-passport/passport-core": coreMock(core),
    "@/lib/server/auth": authMock(auth),
    "@/lib/server/rate-limit": rateLimitMock(rateLimit),
    "@/lib/server/audit": { getRequestAuditContext: () => ({}) },
    ...extra,
  };
}

test("unversioned channel bridge issue route", async (t) => {
  const sourcePath = path.join(apiRoot, "channel/session/bridge/route.ts");

  await t.test("rate-limit denied returns 429", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ rateLimit: denyRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    assert.equal(response.status, 429);
  });

  await t.test("unauthenticated returns redirect/401", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    await assert.rejects(async () => route.POST(new Request("https://passport.test/api/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({}),
    })), /redirect/);
  });

  await t.test("invalid payload returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ auth: { requireAuthenticatedUser: async () => ({ id: "u1" }) } }));
    const response = await route.POST(new Request("https://passport.test/api/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({ channel: "wrong" }),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("issues bridge token with sanitized targetPath", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ auth: { requireAuthenticatedUser: async () => ({ id: "u1" }) } }));
    const response = await route.POST(new Request("https://passport.test/api/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({ targetPath: "/en/dashboard" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.bridgeToken.channel, "SHCW");
    assert.equal(response.payload.bridgeToken.targetPath, "/en/dashboard");
  });
});

test("unversioned channel bridge exchange route", async (t) => {
  const sourcePath = path.join(apiRoot, "channel/session/exchange/route.ts");

  await t.test("rate-limit denied returns 429", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ rateLimit: denyRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/channel/session/exchange", {
      method: "POST",
      body: JSON.stringify({ token: "t", locale: "en" }),
    }));
    assert.equal(response.status, 429);
  });

  await t.test("invalid payload returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/channel/session/exchange", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    assert.equal(response.status, 400);
  });

  await t.test("invalid or expired token returns 401", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/channel/session/exchange", {
      method: "POST",
      body: JSON.stringify({ token: "expired", locale: "en" }),
    }));
    assert.equal(response.status, 401);
  });

  await t.test("successful exchange returns redirect", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      auth: {
        exchangeChannelBridgeToken: async () => ({ userId: "u1", role: "ATTENDEE", targetPath: "/en/dashboard/climate-passport" }),
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/channel/session/exchange", {
      method: "POST",
      body: JSON.stringify({ token: "valid", locale: "en" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.redirectTo, "/en/dashboard/climate-passport");
  });
});

test("v1 channel bridge issue route", async (t) => {
  const sourcePath = path.join(apiRoot, "v1/channel/session/bridge/route.ts");

  await t.test("channel disabled returns 403", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ core: { enabled: false } }));
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW" }),
    }));
    assert.equal(response.status, 403);
    assert.equal(response.payload.error.code, "CHANNEL_DISABLED");
  });

  await t.test("unauthenticated returns 401", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW" }),
    }));
    assert.equal(response.status, 401);
    assert.equal(response.payload.error.code, "UNAUTHENTICATED");
  });

  await t.test("invalid request body returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ auth: { getCurrentUser: async () => ({ id: "u1" }) } }));
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({ channel: "WRONG" }),
    }));
    assert.equal(response.status, 400);
    assert.equal(response.payload.error.code, "INVALID_REQUEST");
  });

  await t.test("malformed targetPath returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ auth: { getCurrentUser: async () => ({ id: "u1" }) } }));
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW", targetPath: "/evil/path" }),
    }));
    assert.equal(response.status, 400);
    assert.equal(response.payload.error.code, "INVALID_REQUEST");
  });

  await t.test("rate-limit denied returns 429", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ rateLimit: denyRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW" }),
    }));
    assert.equal(response.status, 429);
    assert.equal(response.payload.error.code, "RATE_LIMITED");
  });

  await t.test("rate-limit unavailable returns 503", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ rateLimit: unavailableRateLimit }));
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW" }),
    }));
    assert.equal(response.status, 503);
    assert.equal(response.payload.error.code, "SERVICE_UNAVAILABLE");
  });

  await t.test("successful issue returns typed bridge token", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ auth: { getCurrentUser: async () => ({ id: "u1" }) } }));
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/bridge", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW", targetPath: "/zh/dashboard" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.bridgeToken.channel, "SHCW");
    assert.equal(response.payload.bridgeToken.targetPath, "/zh/dashboard");
    assert.ok(BridgeIssueResponseSchema.safeParse(response.payload).success);
  });
});

test("v1 channel bridge exchange route", async (t) => {
  const sourcePath = path.join(apiRoot, "v1/channel/session/exchange/route.ts");

  await t.test("channel disabled returns 403", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ core: { enabled: false } }));
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/exchange", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW", token: "t", locale: "en" }),
    }));
    assert.equal(response.status, 403);
    assert.equal(response.payload.error.code, "CHANNEL_DISABLED");
  });

  await t.test("invalid payload returns 400", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/exchange", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW" }),
    }));
    assert.equal(response.status, 400);
    assert.equal(response.payload.error.code, "INVALID_REQUEST");
  });

  await t.test("invalid bridge token returns 401", async () => {
    const route = loadRouteModule(sourcePath, baseMocks());
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/exchange", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW", token: "bad", locale: "en" }),
    }));
    assert.equal(response.status, 401);
    assert.equal(response.payload.error.code, "INVALID_BRIDGE_TOKEN");
  });

  await t.test("successful exchange returns typed redirect", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      auth: {
        exchangeChannelBridgeToken: async () => ({ userId: "u1", role: "ADMIN", targetPath: null }),
      },
    }));
    const response = await route.POST(new Request("https://passport.test/api/v1/channel/session/exchange", {
      method: "POST",
      body: JSON.stringify({ channel: "SHCW", token: "valid", locale: "en" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.redirectTo, "/en/admin/events");
    assert.ok(BridgeExchangeResponseSchema.safeParse(response.payload).success);
  });
});

test("v1 channel certificate verify route", async (t) => {
  const sourcePath = path.join(apiRoot, "v1/channel/certificates/verify/[code]/route.ts");

  await t.test("channel disabled returns 403", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({ core: { enabled: false } }));
    const response = await route.GET(new Request("https://passport.test/api/v1/channel/certificates/verify/CV-123"), { params: { code: "CV-123" } });
    assert.equal(response.status, 403);
    assert.equal(response.payload.error.code, "CHANNEL_DISABLED");
  });

  await t.test("not found returns 404 typed response", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      extra: {
        "@/lib/server/certificate-verification": {
          resolvePublicCertificateVerification: async () => ({ httpStatus: 404, valid: false, result: "NOT_FOUND", verificationCode: "CV-123", accessLevel: "PUBLIC" }),
        },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/v1/channel/certificates/verify/CV-123"), { params: { code: "CV-123" } });
    assert.equal(response.status, 404);
    assert.ok(PublicCertificateVerificationResponseSchema.safeParse(response.payload).success);
  });

  await t.test("valid public certificate returns minimum-disclosure response", async () => {
    const route = loadRouteModule(sourcePath, baseMocks({
      extra: {
        "@/lib/server/certificate-verification": {
          resolvePublicCertificateVerification: async () => ({
          httpStatus: 200,
          valid: true,
          result: "VALID",
          verificationCode: "CV-123",
          accessLevel: "PUBLIC",
          certificate: {
            title: "Course",
            holderName: "Alice",
            maskedPassportId: "CP-****-0001",
            issuingOrganization: "Climate Passport",
            issuedAt: new Date().toISOString(),
            expiryDate: null,
            credentialType: "Course",
            certificateNumber: "CV-123",
            verifiedAt: new Date().toISOString(),
          },
        }),
      },
      },
    }));
    const response = await route.GET(new Request("https://passport.test/api/v1/channel/certificates/verify/CV-123"), { params: { code: "CV-123" } });
    assert.equal(response.status, 200);
    assert.ok(PublicCertificateVerificationResponseSchema.safeParse(response.payload).success);
    assert.equal(response.payload.certificate.maskedPassportId, "CP-****-0001");
    assert.equal(response.payload.certificate.holderEmail, undefined);
    assert.equal(response.payload.certificate.extended, undefined);
  });
});
