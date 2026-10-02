import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { ApiErrorCodeSchema, OpenApiErrorSchema, type OpenApiError } from "@climate-passport/passport-contracts";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import {
  evaluateSourceConstraint,
  isChannelMachineKeyExpired,
  parseOpenApiKey,
  readCallerIp,
  touchChannelMachineKeyLastUsed,
  verifyChannelMachineSecret,
} from "@/lib/server/channel-client-auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { requestOrigin, withOpenApiCors } from "@/lib/server/open-api-cors";
import { checkRateLimitAsync, getRateLimitRetryAfter, type RateLimitResult } from "@/lib/server/rate-limit";

/**
 * Open API 控制面：对外接口只认 API Key，不认 cookie 会话。
 *
 * 凭据复用已登记的 ChannelClient（type=MACHINE），bearer 形态是
 * `<clientKey>.<machineKey>`：库中存的是 bcrypt（带随机盐），**不可能**按摘要反查行，
 * 所以凭据必须自带客户端标识，先定位行再逐行校验。双头形态
 * （`x-channel-client-key` + `x-channel-machine-key`）走的是同一把密钥、同一套规则，
 * 不另建凭据体系。
 *
 * 失败一律 fail-closed，且不存在「没带头就退回公开行为」的分支：那会让公开路径变成
 * 鉴权失败的逃生口。
 */

const BEARER_PREFIX = "bearer ";
/** clientKey 上限 63 + 分隔符 + 机密上限 72（bcrypt 的输入截断边界，见 parseOpenApiKey）。 */
const MAX_BEARER_LENGTH = 136;

export type OpenApiClientIdentity = {
  id: string;
  key: string;
  displayName: string;
  programmeId: string;
  scopes: string[];
  /** 浏览器可达性只由这里决定；无 Origin 的服务端调用改看 allowedIps。 */
  allowedOrigins: string[];
  allowedIps: string[];
  /** 该 key 生效中的配额：登记值优先，未登记则为服务端默认。 */
  rateLimit: { limit: number; windowMs: number; configured: boolean };
  keyMeta: {
    algorithm: "bcrypt" | "sha256-legacy";
    issuedAt: Date | null;
    expiresAt: Date | null;
    rotatedAt: Date | null;
    lastUsedAt: Date | null;
  };
};

export type OpenApiErrorCode =
  | "API_KEY_MISSING"
  | "API_KEY_INVALID"
  | "API_KEY_EXPIRED"
  | "API_KEY_SCOPE_DENIED"
  | "API_KEY_ORIGIN_DENIED"
  | "API_KEY_IP_DENIED"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE";

const OPEN_API_ERROR_MESSAGES: Record<OpenApiErrorCode, string> = {
  API_KEY_MISSING: "Missing API key. Send it as Authorization: Bearer <api key>.",
  API_KEY_INVALID: "Invalid API key.",
  API_KEY_EXPIRED: "The API key has expired. Rotate it from the admin console.",
  API_KEY_SCOPE_DENIED: "The API key does not grant this scope.",
  API_KEY_ORIGIN_DENIED: "The API key does not allow this browser origin.",
  API_KEY_IP_DENIED: "The API key does not allow this caller address.",
  RATE_LIMITED: "Too many requests for this API key.",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable.",
};

const DEFAULT_LIMIT = { limit: 60, windowMs: 60_000 };

function positiveInt(raw: string | undefined, fallback: number) {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Unauthenticated attempts are capped per source address to keep key guessing expensive,
 * and to bound how much bcrypt work one address can force per window.
 *
 * 上限可按环境变量上调（集成测试环境里所有调用共用同一个不可归因的来源地址，见
 * `.env.test`）：这只是一个数值，判定分支不变——生产默认始终是 20。
 */
const UNAUTHENTICATED_LIMIT = {
  limit: positiveInt(process.env.OPEN_API_UNAUTHENTICATED_LIMIT, 20),
  windowMs: positiveInt(process.env.OPEN_API_UNAUTHENTICATED_WINDOW_MS, 60_000),
};

export function openApiRequestId() {
  return randomUUID();
}

export function openApiError(input: { code: OpenApiErrorCode; status: number; requestId: string; retryAfter?: number }) {
  const body: OpenApiError = OpenApiErrorSchema.parse({
    error: {
      code: input.code,
      message: OPEN_API_ERROR_MESSAGES[input.code],
      requestId: input.requestId,
      ...(input.retryAfter === undefined ? {} : { retryAfter: input.retryAfter }),
    },
  });
  return NextResponse.json(body, {
    status: input.status,
    headers: {
      "x-request-id": input.requestId,
      ...(input.retryAfter === undefined ? {} : { "Retry-After": String(input.retryAfter) }),
    },
  });
}

/** 与 `openApiError` 同一 envelope，但由领域层决定文案（校验失败原因、冲突对象等）。 */
function openApiErrorWithMessage(input: { code: string; status: number; requestId: string; message: string }) {
  const body: OpenApiError = OpenApiErrorSchema.parse({
    error: {
      code: input.code,
      message: input.message.slice(0, 300) || "Request failed.",
      requestId: input.requestId,
    },
  });
  return NextResponse.json(body, { status: input.status, headers: { "x-request-id": input.requestId } });
}

/** Success responses share the request-id header so a caller can line its logs up with the audit row. */
export function openApiResponse(requestId: string, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
}

/**
 * 路由成功响应的唯一出口：带上 x-request-id，并在来源已通过 allowedOrigins 校验时
 * 回显 CORS。服务端调用没有 Origin，因此不加任何跨源头。
 */
export function openApiOk(gate: { requestId: string; corsOrigin: string | null }, body: unknown, status = 200) {
  return withOpenApiCors(openApiResponse(gate.requestId, body, status), gate.corsOrigin);
}

/** 领域层统一的失败形态：`{ error, status, code }`（见 source-activity-mapping 等模块）。 */
export type OpenApiDomainFailure = { error: string; status: number; code: string };

/**
 * 业务拒绝沿用与控制面完全相同的错误 envelope，只是 code/message 来自领域层。
 * 未登记的 code 会退化成 `INTERNAL_ERROR` 并打日志：对外宁可少说原因，也不能吐出
 * 一个契约里没有、调用方无法枚举的错误码。
 */
export function openApiDomainError(requestId: string, failure: OpenApiDomainFailure) {
  const parsed = ApiErrorCodeSchema.safeParse(failure.code);
  if (!parsed.success) {
    console.error(`[open-api] unregistered error code "${failure.code}" (status ${failure.status})`);
  }
  return openApiErrorWithMessage({
    code: parsed.success ? parsed.data : "INTERNAL_ERROR",
    status: parsed.success ? failure.status : 500,
    requestId,
    message: failure.error,
  });
}

/** 请求体未通过契约校验：对外统一 400 INVALID_REQUEST，文案取第一条 issue。 */
export function openApiInvalidRequest(requestId: string, message: string) {
  return openApiErrorWithMessage({ code: "INVALID_REQUEST", status: 400, requestId, message });
}

export type OpenApiKeyPresentation =
  | { shape: "present"; token: string }
  | { shape: "absent" }
  | { shape: "malformed" };

/** Only `Authorization: Bearer <key>` is accepted; no query-string keys (they land in access logs). */
export function readOpenApiKey(headers: Headers): OpenApiKeyPresentation {
  const header = headers.get("authorization");
  if (!header) return { shape: "absent" };
  if (!header.toLowerCase().startsWith(BEARER_PREFIX)) return { shape: "malformed" };
  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token || token.length > MAX_BEARER_LENGTH) return { shape: "malformed" };
  return { shape: "present", token };
}

type PrismaLike = Pick<PrismaClient, "channelClient">;

export type OpenKeyAuthFailure = {
  status: 401 | 403;
  code: OpenApiErrorCode;
  /** Present once the key resolved, so the denial stays attributable in the audit log. */
  clientId?: string;
  clientKey?: string;
};

export type OpenKeyAuthResult = { ok: true; client: OpenApiClientIdentity } | ({ ok: false } & OpenKeyAuthFailure);

/**
 * Resolve the presented key to an active machine client, then apply the key's own policy:
 * expiry → scope → source (browser origin / caller IP). `requiredScope` omitted means
 * "any active key", used by introspection, which only ever returns the caller's own identity.
 */
export async function authenticateOpenApiKey(
  prisma: PrismaLike,
  input: { token: string; requiredScope?: string; origin: string | null; clientIp: string | null },
): Promise<OpenKeyAuthResult> {
  const parsed = parseOpenApiKey(input.token);
  if (!parsed) return { ok: false, status: 401, code: "API_KEY_INVALID" };

  const client = await prisma.channelClient.findFirst({
    where: { key: parsed.clientKey, type: "MACHINE" },
    select: {
      id: true, key: true, displayName: true, programmeId: true, allowedScopes: true,
      allowedOrigins: true, allowedIps: true, isActive: true,
      machineKeyHash: true, machineKeyBcrypt: true, machineKeyIssuedAt: true,
      machineKeyExpiresAt: true, machineKeyRotatedAt: true, machineKeyLastUsedAt: true,
      rateLimitLimit: true, rateLimitWindowMs: true,
      programme: { select: { isActive: true } },
    },
  });
  if (!client || !client.isActive || !client.programme.isActive) {
    return { ok: false, status: 401, code: "API_KEY_INVALID" };
  }

  if (!client.machineKeyHash && !client.machineKeyBcrypt) {
    return { ok: false, status: 401, code: "API_KEY_INVALID" };
  }
  if (!(await verifyChannelMachineSecret(client, parsed.machineKey))) {
    return { ok: false, status: 401, code: "API_KEY_INVALID" };
  }

  const denied = (status: 403, code: OpenApiErrorCode): OpenKeyAuthResult => ({
    ok: false, status, code, clientId: client.id, clientKey: client.key,
  });
  if (isChannelMachineKeyExpired(client.machineKeyExpiresAt)) return denied(403, "API_KEY_EXPIRED");
  if (input.requiredScope && !client.allowedScopes.includes(input.requiredScope)) return denied(403, "API_KEY_SCOPE_DENIED");

  const source = evaluateSourceConstraint({
    origin: input.origin,
    clientIp: input.clientIp,
    allowedOrigins: client.allowedOrigins,
    allowedIps: client.allowedIps,
  });
  if (source === "ORIGIN_DENIED") return denied(403, "API_KEY_ORIGIN_DENIED");
  if (source === "IP_DENIED") return denied(403, "API_KEY_IP_DENIED");

  await touchChannelMachineKeyLastUsed(prisma, client.id);
  return {
    ok: true,
    client: {
      id: client.id,
      key: client.key,
      displayName: client.displayName,
      programmeId: client.programmeId,
      scopes: client.allowedScopes,
      allowedOrigins: client.allowedOrigins,
      allowedIps: client.allowedIps,
      rateLimit: {
        limit: client.rateLimitLimit ?? DEFAULT_LIMIT.limit,
        windowMs: client.rateLimitWindowMs ?? DEFAULT_LIMIT.windowMs,
        configured: client.rateLimitLimit !== null && client.rateLimitWindowMs !== null,
      },
      keyMeta: {
        algorithm: client.machineKeyBcrypt ? "bcrypt" : "sha256-legacy",
        issuedAt: client.machineKeyIssuedAt ?? null,
        expiresAt: client.machineKeyExpiresAt ?? null,
        rotatedAt: client.machineKeyRotatedAt ?? null,
        lastUsedAt: client.machineKeyLastUsedAt ?? null,
      },
    },
  };
}

export type OpenApiGate =
  | {
      ok: true;
      prisma: PrismaClient;
      requestId: string;
      client: OpenApiClientIdentity;
      rateLimit: RateLimitResult & { limit: number; windowMs: number };
      /** 已通过 allowedOrigins 校验的浏览器来源；服务端调用为 null。响应用 openApiOk 才会带上 CORS 头。 */
      corsOrigin: string | null;
    }
  | { ok: false; response: NextResponse; requestId: string };

/**
 * The single entry point Open API route handlers call first. Returns a ready-to-return
 * NextResponse on any failure, so a forgotten check degrades to "no client", never to
 * "request authorized".
 */
export async function requireOpenApiKey(
  request: Request,
  options: { scope?: string; rateLimit?: { limit: number; windowMs: number } } = {},
): Promise<OpenApiGate> {
  const requestId = openApiRequestId();
  const auditContext = getRequestAuditContext(request);
  // 只在凭据校验通过之后才有资格回显 Origin：校验失败的请求连自己是谁都还没证明。
  let corsOrigin: string | null = null;
  const prisma = getPrismaClient();
  if (!prisma) {
    return { ok: false, requestId, response: openApiError({ code: "SERVICE_UNAVAILABLE", status: 503, requestId }) };
  }

  // sensitive: without distributed protection the anonymous brute-force cap would silently
  // degrade to per-process buckets, which is exactly when it needs to hold.
  const unattributed = `open-api:unauthenticated:${auditContext.ipAddress ?? "source-unattributed"}`;
  const consumeUnauthenticatedBudget = async () =>
    checkRateLimitAsync(unattributed, { ...UNAUTHENTICATED_LIMIT, sensitive: true });

  const deny = async (failure: { status: number; code: OpenApiErrorCode }, subject: { subjectType: string; subjectId: string | null }, extra?: Record<string, unknown>) => {
    await writeCoreAuditLog({
      action: "openapi.access.denied",
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      result: failure.code,
      ...auditContext,
      metadataJson: { requestId, clientKey: extra?.clientKey ?? null, requiredScope: options.scope ?? null, ...extra },
    }).catch(() => null);
    const retryAfter = typeof extra?.retryAfter === "number" ? extra.retryAfter : undefined;
    return {
      ok: false as const,
      requestId,
      response: withOpenApiCors(
        openApiError({ code: failure.code, status: failure.status, requestId, ...(retryAfter === undefined ? {} : { retryAfter }) }),
        corsOrigin,
      ),
    };
  };

  const presentation = readOpenApiKey(request.headers);
  if (presentation.shape !== "present") {
    const unauthenticated = await consumeUnauthenticatedBudget();
    if (!unauthenticated.allowed) {
      return { ok: false, requestId, response: openApiError({ code: unauthenticated.unavailable ? "SERVICE_UNAVAILABLE" : "RATE_LIMITED", status: unauthenticated.unavailable ? 503 : 429, requestId, ...(unauthenticated.unavailable ? {} : { retryAfter: getRateLimitRetryAfter(unauthenticated) }) }) };
    }
    return deny(
      { status: 401, code: presentation.shape === "absent" ? "API_KEY_MISSING" : "API_KEY_INVALID" },
      { subjectType: "OpenApi", subjectId: null },
    );
  }

  const auth = await authenticateOpenApiKey(prisma, {
    token: presentation.token,
    requiredScope: options.scope,
    origin: request.headers.get("origin"),
    clientIp: readCallerIp(request.headers),
  });
  if (!auth.ok) {
    // A rejected key is an unauthenticated attempt: it draws on the same per-address budget,
    // which bounds both key guessing and the bcrypt work an attacker can force per window.
    const unauthenticated = await consumeUnauthenticatedBudget();
    if (!unauthenticated.allowed) {
      return { ok: false, requestId, response: openApiError({ code: unauthenticated.unavailable ? "SERVICE_UNAVAILABLE" : "RATE_LIMITED", status: unauthenticated.unavailable ? 503 : 429, requestId, ...(unauthenticated.unavailable ? {} : { retryAfter: getRateLimitRetryAfter(unauthenticated) }) }) };
    }
    return deny(
      { status: auth.status, code: auth.code },
      { subjectType: auth.clientId ? "ChannelClient" : "OpenApi", subjectId: auth.clientId ?? null },
      auth.clientKey ? { clientKey: auth.clientKey } : undefined,
    );
  }

  // 走到这里说明 allowedOrigins 已经放行过这个 Origin（无 Origin 时为 null）。
  corsOrigin = requestOrigin(request);

  // 配额优先级：该 key 的登记值 > 端点自带默认 > 全局默认。管理台为合作伙伴约定的
  // 额度是契约，端点不应能在代码里把它悄悄压低或抬高。
  const limit = auth.client.rateLimit.configured ? auth.client.rateLimit : options.rateLimit ?? DEFAULT_LIMIT;
  const rateLimit = await checkRateLimitAsync(`open-api:${auth.client.id}:${options.scope ?? "introspect"}`, { ...limit, sensitive: true });
  if (rateLimit.unavailable) {
    return { ok: false, requestId, response: openApiError({ code: "SERVICE_UNAVAILABLE", status: 503, requestId }) };
  }
  if (!rateLimit.allowed) {
    return deny(
      { status: 429, code: "RATE_LIMITED" },
      { subjectType: "ChannelClient", subjectId: auth.client.id },
      { clientKey: auth.client.key, retryAfter: getRateLimitRetryAfter(rateLimit) },
    );
  }

  return { ok: true, prisma, requestId, client: auth.client, rateLimit: { ...rateLimit, ...limit }, corsOrigin };
}
