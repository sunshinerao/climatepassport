import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { CHANNEL_SCOPE_VALUES, ChannelKeySchema } from "@climate-passport/passport-contracts";
import { ipInAllowlist, isValidIpOrCidr } from "@/lib/server/ip-cidr";
import { normalizedIp } from "@/lib/server/rate-limit";

/**
 * CP-TODO-243：渠道机器客户端认证（CP-FR-069）。
 *
 * 用户流程（SHCW bridge/exchange，cookie 会话）与机器流程彻底分离：
 * 机器客户端必须在 ChannelClient 登记（type = MACHINE、programme 有效、
 * allowedScopes/allowedOrigins 明确），调用时出示 client key + machine key。
 * secret 绝不以内联形式落库；未知/停用客户端、密钥不匹配、密钥过期、
 * scope 不允许、origin 不在 allowlist 一律 fail-closed。
 *
 * 存储形态有两代：新登记与轮换后的 key 走 bcrypt（`machineKeyBcrypt`），
 * 迁移前的存量行仍是无盐 sha256 摘要（`machineKeyHash`），轮换时清空。
 * bcrypt 带随机盐、不可重复计算，因此**不能再用摘要反查客户端**——凭据必须自带
 * 客户端标识（`<clientKey>.<machineKey>`），先定位行再逐行校验。
 */

export const MACHINE_CLIENT_KEY_HEADER = "x-channel-client-key";
export const MACHINE_CLIENT_SECRET_HEADER = "x-channel-machine-key";

export const MACHINE_KEY_PREFIX = "cpmk_";
/** Open API 的 bearer 形态：`<clientKey>.<machineKey>`。 */
export const OPEN_API_KEY_SEPARATOR = ".";

/** 与用户口令同档；machine secret 只有 37 字节，远未触及 bcrypt 的 72 字节输入上限。 */
const MACHINE_KEY_BCRYPT_COST = 10;
/**
 * bcrypt 会静默丢弃第 72 字节之后的输入，因此超长机密等价于它的前 72 字节。
 * 与其让两把不同的 key 通过同一行校验，不如在解析阶段就拒绝。
 */
const MACHINE_KEY_MAX_LENGTH = 72;
/** lastUsedAt 只是运维可见性，写入按该间隔节流，避免每次调用一趟 UPDATE。 */
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

export type ChannelMachineAuthResult =
  | { ok: true; client: { id: string; key: string; displayName: string; programmeId: string } }
  | {
      ok: false;
      status: 401 | 403;
      code:
        | "UNKNOWN_CLIENT"
        | "MACHINE_AUTH_FAILED"
        | "MACHINE_KEY_EXPIRED"
        | "SCOPE_DENIED"
        | "ORIGIN_DENIED"
        | "IP_DENIED";
    };

type PrismaLike = Pick<PrismaClient, "channelClient">;

/** 迁移前存量的定位地址：无盐 sha256 摘要。仅用于校验旧行，新登记不再写入。 */
export function hashChannelMachineKey(machineKey: string) {
  return createHash("sha256").update(machineKey, "utf8").digest("hex");
}

/** 新登记与轮换一律走 bcrypt；明文只在创建/轮换响应里出现一次。 */
export async function hashChannelMachineKeyBcrypt(machineKey: string) {
  const { hash } = await import("bcryptjs");
  return hash(machineKey, MACHINE_KEY_BCRYPT_COST);
}

/** 生成一次性返回的 machine key（32 位 base64url 随机后缀，192 bit 熵）。 */
export function generateChannelMachineKey() {
  return `${MACHINE_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

/** 组装对外可粘贴的 Open API 凭据：客户端标识 + 机密，bcrypt 无法按摘要反查，故必须自带标识。 */
export function formatOpenApiKey(clientKey: string, machineKey: string) {
  return `${clientKey}${OPEN_API_KEY_SEPARATOR}${machineKey}`;
}

export function parseOpenApiKey(token: string): { clientKey: string; machineKey: string } | null {
  const separatorIndex = token.indexOf(OPEN_API_KEY_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) return null;
  const clientKey = token.slice(0, separatorIndex);
  const machineKey = token.slice(separatorIndex + 1);
  if (!ChannelKeySchema.safeParse(clientKey).success) return null;
  if (!machineKey.startsWith(MACHINE_KEY_PREFIX) || machineKey.length > MACHINE_KEY_MAX_LENGTH) return null;
  return { clientKey, machineKey };
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

type MachineSecretHolder = { machineKeyHash: string | null; machineKeyBcrypt: string | null };

/** 按行的存储形态分派校验；两种都没有配置时视为无凭据，绝不退化成「空密钥通过」。 */
export async function verifyChannelMachineSecret(row: MachineSecretHolder, machineKey: string) {
  if (row.machineKeyBcrypt) {
    try {
      const { compare } = await import("bcryptjs");
      return await compare(machineKey, row.machineKeyBcrypt);
    } catch {
      return false;
    }
  }
  if (row.machineKeyHash) return safeEqualHex(hashChannelMachineKey(machineKey), row.machineKeyHash);
  return false;
}

/** `expiresAt` 为空表示该 key 早于过期策略存在；有值且已过即拒绝。 */
export function isChannelMachineKeyExpired(expiresAt: Date | null | undefined, now = Date.now()) {
  return Boolean(expiresAt && expiresAt.getTime() <= now);
}

/** 节流写最近使用时间；失败不影响认证结论，故不向上抛。 */
export async function touchChannelMachineKeyLastUsed(prisma: PrismaLike, clientId: string, now = new Date()) {
  const threshold = new Date(now.getTime() - LAST_USED_WRITE_INTERVAL_MS);
  await prisma.channelClient
    .updateMany({
      where: { id: clientId, OR: [{ machineKeyLastUsedAt: null }, { machineKeyLastUsedAt: { lt: threshold } }] },
      data: { machineKeyLastUsedAt: now },
    })
    .catch(() => null);
}

/**
 * 来源地址解析：仅在 `RATE_LIMIT_TRUST_PROXY=true`（部署在可信反代之后）时采信
 * `x-forwarded-for`，否则只看 `x-real-ip`。与限流分桶共用同一判定，避免两处对
 * 「调用方是谁」意见不一致。
 */
export function readCallerIp(headers: Headers): string | null {
  const realIp = normalizedIp(headers.get("x-real-ip"));
  if (process.env.RATE_LIMIT_TRUST_PROXY !== "true") return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((value) => normalizedIp(value)).find(Boolean);
  return forwarded ?? realIp;
}

/**
 * 来源约束（CP-FR-069，2026-09-21 决议「浏览器来源强校验 + IP 白名单」）：
 * - 出现 `Origin` 即按浏览器请求处理，必须命中 `allowedOrigins`。空白名单不再等于放行：
 *   把 API Key 带进浏览器本身就违反密钥契约。
 * - 没有 `Origin` 的是服务端到服务端调用，按 `allowedIps` 约束；白名单非空却无从归因来源
 *   地址时 fail-closed。白名单为空表示不加这层约束（此时把关的仍是密钥本身 + scope）。
 */
export function evaluateSourceConstraint(input: {
  origin: string | null;
  clientIp: string | null;
  allowedOrigins: string[];
  allowedIps: string[];
}): "ALLOWED" | "ORIGIN_DENIED" | "IP_DENIED" {
  if (input.origin !== null) {
    const presented = input.origin.trim().replace(/\/$/, "");
    const allowed = input.allowedOrigins.map((origin) => origin.trim().replace(/\/$/, ""));
    return presented && allowed.includes(presented) ? "ALLOWED" : "ORIGIN_DENIED";
  }
  if (input.allowedIps.length === 0) return "ALLOWED";
  return input.clientIp && ipInAllowlist(input.clientIp, input.allowedIps) ? "ALLOWED" : "IP_DENIED";
}

/**
 * 机器客户端认证：默认拒绝。凭据为双头形态（client key + machine key）。
 * 过期、scope、来源（Origin / IP）任一不过即为 403；身份或密钥本身不过为 401。
 */
export async function authenticateChannelMachine(
  prisma: PrismaLike,
  input: {
    clientKey: string;
    machineKey: string;
    requiredScope: string;
    origin: string | null;
    clientIp?: string | null | undefined;
  },
): Promise<ChannelMachineAuthResult> {
  const client = await prisma.channelClient.findFirst({
    where: {
      key: input.clientKey,
      isActive: true,
      type: "MACHINE",
      programme: { isActive: true },
    },
    select: {
      id: true, key: true, displayName: true, programmeId: true,
      machineKeyHash: true, machineKeyBcrypt: true, machineKeyExpiresAt: true,
      allowedScopes: true, allowedOrigins: true, allowedIps: true,
    },
  });
  if (!client) {
    return { ok: false, status: 401, code: "UNKNOWN_CLIENT" };
  }

  if (!client.machineKeyHash && !client.machineKeyBcrypt) {
    return { ok: false, status: 401, code: "MACHINE_AUTH_FAILED" };
  }
  if (!(await verifyChannelMachineSecret(client, input.machineKey))) {
    return { ok: false, status: 401, code: "MACHINE_AUTH_FAILED" };
  }
  if (isChannelMachineKeyExpired(client.machineKeyExpiresAt)) {
    return { ok: false, status: 403, code: "MACHINE_KEY_EXPIRED" };
  }

  if (!client.allowedScopes.includes(input.requiredScope)) {
    return { ok: false, status: 403, code: "SCOPE_DENIED" };
  }

  const source = evaluateSourceConstraint({
    origin: input.origin,
    clientIp: input.clientIp ?? null,
    allowedOrigins: client.allowedOrigins,
    allowedIps: client.allowedIps,
  });
  if (source !== "ALLOWED") return { ok: false, status: 403, code: source };

  await touchChannelMachineKeyLastUsed(prisma, client.id);
  return { ok: true, client: { id: client.id, key: client.key, displayName: client.displayName, programmeId: client.programmeId } };
}

/**
 * 认证拒绝码 → 对外 `CHANNEL_*` 错误码的单一映射表。放在这里而非各调用点，
 * 是为了让双头机器端点（`/api/v1/channel`）对所有客户端说同一套话；
 * Open API（`/api/v1/open`）走的是同一套判定，但按 API_KEY_* 命名（见 open-api-auth.ts）。
 * 新增拒绝码时 TS 会强制在此登记，避免被静默归到语义不符的原因上。
 */
export const MACHINE_AUTH_ERROR_CODES: Record<Exclude<ChannelMachineAuthResult, { ok: true }>["code"], "CHANNEL_MACHINE_AUTH_FAILED" | "CHANNEL_MACHINE_KEY_EXPIRED" | "CHANNEL_SCOPE_DENIED" | "CHANNEL_ORIGIN_DENIED" | "CHANNEL_IP_DENIED"> = {
  UNKNOWN_CLIENT: "CHANNEL_MACHINE_AUTH_FAILED",
  MACHINE_AUTH_FAILED: "CHANNEL_MACHINE_AUTH_FAILED",
  MACHINE_KEY_EXPIRED: "CHANNEL_MACHINE_KEY_EXPIRED",
  SCOPE_DENIED: "CHANNEL_SCOPE_DENIED",
  ORIGIN_DENIED: "CHANNEL_ORIGIN_DENIED",
  IP_DENIED: "CHANNEL_IP_DENIED",
};

/** 从请求头提取机器认证凭据；未携带任一头部时返回 null（调用方走旧有用户流程）。 */
export function readMachineCredentials(headers: Headers): { clientKey: string; machineKey: string } | null {
  const clientKey = headers.get(MACHINE_CLIENT_KEY_HEADER);
  const machineKey = headers.get(MACHINE_CLIENT_SECRET_HEADER);
  if (!clientKey && !machineKey) return null;
  if (!clientKey || !machineKey) return { clientKey: clientKey ?? "", machineKey: machineKey ?? "" };
  return { clientKey, machineKey };
}

/* ---------------------------------------------------------------------------
 * CP-TODO-243: ChannelClient 登记生命周期（ADMIN 后台）。创建/更新/轮换/撤销全部
 * 与审计同事务；密钥明文只在创建或轮换响应里出现一次。
 * ------------------------------------------------------------------------- */

export type ChannelClientType = "USER_FACING" | "MACHINE";

type RegistryPrisma = Pick<PrismaClient, "channelClient" | "programme" | "coreAuditLog"> & {
  $transaction: PrismaClient["$transaction"];
};

export type RegistryError = { error: string; status: number };

function registryError(error: string, status: number): RegistryError {
  return { error, status };
}

/**
 * Rejection sampling, not `% alphabet.length`: 36 does not divide 256, so a modulo would
 * quietly bias the last characters (`0`–`7` appear slightly more often than `8`–`Z`).
 */
function generateChannelClientKey() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const unbiasedLimit = Math.floor(256 / alphabet.length) * alphabet.length;
  let key = "CPK";
  while (key.length < 15) {
    for (const byte of randomBytes(16)) {
      if (byte >= unbiasedLimit) continue;
      key += alphabet[byte % alphabet.length];
      if (key.length === 15) break;
    }
  }
  return key;
}

export function validateCallbackUrl(callbackUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    return "Invalid callbackUrl.";
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocal && url.protocol !== "https:") return "callbackUrl must use https outside localhost.";
  return null;
}

/** origin 校验：必须是 http(s) URL origin；非 localhost 强制 https（CP-FR-069 真实域名验证）。 */
export function validateAllowedOrigins(origins: string[]): string | null {
  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return `Invalid origin: ${origin}`;
    }
    if (url.origin !== origin.replace(/\/$/, "")) return `Origin must not contain a path: ${origin}`;
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!isLocal && url.protocol !== "https:") return `Origin must use https: ${origin}`;
  }
  return null;
}

function validateAllowedScopes(scopes: string[]): string | null {
  const catalog = CHANNEL_SCOPE_VALUES as readonly string[];
  for (const scope of scopes) {
    if (!catalog.includes(scope)) return `Unknown channel scope: ${scope}`;
  }
  return null;
}

/** 新登记的 key 一律带过期；历史行留空表示早于该策略签发。 */
export const MACHINE_KEY_DEFAULT_VALID_DAYS = 365;
export const MACHINE_KEY_MAX_VALID_DAYS = 730;

export const RATE_LIMIT_BOUNDS = { minLimit: 1, maxLimit: 100_000, minWindowMs: 1_000, maxWindowMs: 3_600_000 };

/** IP/CIDR 字面量校验；非法条目一律拒绝登记，而不是运行时静默不匹配。 */
export function validateAllowedIps(ips: string[]): string | null {
  if (ips.length > 50) return "allowedIps accepts at most 50 entries.";
  for (const entry of ips) {
    if (!isValidIpOrCidr(entry)) return `Invalid IP or CIDR: ${entry}`;
  }
  return null;
}

export function validateRateLimitConfig(limit: number | undefined, windowMs: number | undefined): string | null {
  if (limit === undefined && windowMs === undefined) return null;
  if (limit === undefined || windowMs === undefined) return "rateLimitLimit and rateLimitWindowMs must be set together.";
  if (!Number.isInteger(limit) || limit < RATE_LIMIT_BOUNDS.minLimit || limit > RATE_LIMIT_BOUNDS.maxLimit) {
    return `rateLimitLimit must be between ${RATE_LIMIT_BOUNDS.minLimit} and ${RATE_LIMIT_BOUNDS.maxLimit}.`;
  }
  if (!Number.isInteger(windowMs) || windowMs < RATE_LIMIT_BOUNDS.minWindowMs || windowMs > RATE_LIMIT_BOUNDS.maxWindowMs) {
    return `rateLimitWindowMs must be between ${RATE_LIMIT_BOUNDS.minWindowMs} and ${RATE_LIMIT_BOUNDS.maxWindowMs}.`;
  }
  return null;
}

export function validateMachineKeyValidity(days: number | undefined): string | null {
  if (days === undefined) return null;
  if (!Number.isInteger(days) || days < 1 || days > MACHINE_KEY_MAX_VALID_DAYS) {
    return `expiresInDays must be between 1 and ${MACHINE_KEY_MAX_VALID_DAYS}.`;
  }
  return null;
}

function machineKeyExpiresAt(days: number | undefined, now = new Date()) {
  const validDays = days ?? MACHINE_KEY_DEFAULT_VALID_DAYS;
  return new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);
}

export async function registerChannelClient(
  prisma: RegistryPrisma,
  input: {
    key?: string | undefined;
    displayName: string;
    type: ChannelClientType;
    programmeId: string;
    allowedOrigins: string[];
    allowedScopes: string[];
    allowedIps?: string[] | undefined;
    rateLimitLimit?: number | undefined;
    rateLimitWindowMs?: number | undefined;
    expiresInDays?: number | undefined;
    machineKey?: string | undefined;
    callbackUrl?: string | undefined;
    actorUserId: string;
  },
): Promise<
  | {
      created: true;
      client: { id: string; key: string; type: ChannelClientType; programmeId: string };
      /** 双头形态用的机密（`x-channel-machine-key`）。 */
      machineKey: string | null;
      /** Open API 用的 `<clientKey>.<machineKey>`；明文只在这里出现一次。 */
      openApiKey: string | null;
      machineKeyExpiresAt: Date | null;
    }
  | RegistryError
> {
  const key = input.key ?? generateChannelClientKey();
  if (!ChannelKeySchema.safeParse(key).success) return registryError("Invalid channel client key.", 400);
  const scopeError = validateAllowedScopes(input.allowedScopes);
  if (scopeError) return registryError(scopeError, 400);
  const originError = validateAllowedOrigins(input.allowedOrigins);
  if (originError) return registryError(originError, 400);
  const ips = input.allowedIps ?? [];
  const ipError = validateAllowedIps(ips);
  if (ipError) return registryError(ipError, 400);
  const rateLimitError = validateRateLimitConfig(input.rateLimitLimit, input.rateLimitWindowMs);
  if (rateLimitError) return registryError(rateLimitError, 400);
  const validityError = validateMachineKeyValidity(input.expiresInDays);
  if (validityError) return registryError(validityError, 400);
  if (input.type === "USER_FACING" && input.machineKey) return registryError("USER_FACING clients do not take a machine key.", 400);
  if (input.machineKey && !input.machineKey.startsWith(MACHINE_KEY_PREFIX)) {
    return registryError(`machineKey must start with ${MACHINE_KEY_PREFIX}`, 400);
  }
  if (input.machineKey && input.machineKey.length > MACHINE_KEY_MAX_LENGTH) {
    return registryError(`machineKey must be at most ${MACHINE_KEY_MAX_LENGTH} characters; bcrypt truncates anything longer.`, 400);
  }
  if (input.callbackUrl) {
    const callbackError = validateCallbackUrl(input.callbackUrl);
    if (callbackError) return registryError(callbackError, 400);
  }

  const issuedMachineKey = input.type === "MACHINE" ? (input.machineKey ?? generateChannelMachineKey()) : null;
  // bcrypt is deliberately expensive, so it runs outside the transaction: a registration
  // must not hold a database transaction open for ~100ms per concurrent admin request.
  const secretHash = issuedMachineKey ? await hashChannelMachineKeyBcrypt(issuedMachineKey) : null;
  const expiresAt = issuedMachineKey ? machineKeyExpiresAt(input.expiresInDays) : null;

  try {
    return await prisma.$transaction(async (tx) => {
      const programme = await tx.programme.findFirst({ where: { id: input.programmeId, isActive: true }, select: { id: true } });
      if (!programme) return registryError("Programme not found or inactive.", 404);

      const issuedAt = new Date();
      const client = await tx.channelClient.create({
        data: {
          key,
          displayName: input.displayName,
          type: input.type,
          programmeId: programme.id,
          allowedOrigins: input.allowedOrigins,
          allowedIps: ips,
          allowedScopes: input.allowedScopes,
          rateLimitLimit: input.rateLimitLimit ?? null,
          rateLimitWindowMs: input.rateLimitWindowMs ?? null,
          machineKeyBcrypt: secretHash,
          machineKeyIssuedAt: issuedMachineKey ? issuedAt : null,
          machineKeyExpiresAt: expiresAt,
          callbackUrl: input.callbackUrl ?? null,
        },
        select: { id: true, key: true, type: true, programmeId: true },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "channel_client.register",
          subjectType: "channel_client",
          subjectId: client.id,
          result: "created",
          metadataJson: {
            key: client.key,
            type: client.type,
            programmeId: client.programmeId,
            allowedScopes: input.allowedScopes,
            allowedOrigins: input.allowedOrigins,
            allowedIps: ips,
            machineKeyIssued: Boolean(issuedMachineKey),
            machineKeyAlgorithm: issuedMachineKey ? "bcrypt" : null,
            machineKeyExpiresAt: expiresAt ? expiresAt.toISOString() : null,
            rateLimit: input.rateLimitLimit && input.rateLimitWindowMs ? { limit: input.rateLimitLimit, windowMs: input.rateLimitWindowMs } : null,
          },
        },
      });
      return {
        created: true,
        client,
        machineKey: issuedMachineKey,
        openApiKey: issuedMachineKey ? formatOpenApiKey(client.key, issuedMachineKey) : null,
        machineKeyExpiresAt: expiresAt,
      };
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
      return registryError("Channel client key already registered.", 409);
    }
    console.error("channel client registration failed:", error);
    return registryError("Registration failed. No state was changed.", 500);
  }
}

/**
 * 轮换 machine key：新机密覆盖旧机密、清空遗留的 sha256 摘要，因此旧 key 立即失效。
 * `rotatedAt` 记录切换时刻，`issuedAt`/`expiresAt` 重新计时。
 */
export async function rotateChannelClientKey(
  prisma: RegistryPrisma,
  input: { id: string; actorUserId: string; expiresInDays?: number | undefined; reason?: string | undefined },
): Promise<{ client: { id: string; key: string }; machineKey: string; openApiKey: string; machineKeyExpiresAt: Date } | RegistryError> {
  const validityError = validateMachineKeyValidity(input.expiresInDays);
  if (validityError) return registryError(validityError, 400);

  const machineKey = generateChannelMachineKey();
  const secretHash = await hashChannelMachineKeyBcrypt(machineKey);
  const expiresAt = machineKeyExpiresAt(input.expiresInDays);

  try {
    return await prisma.$transaction(async (tx) => {
      const client = await tx.channelClient.findUnique({
        where: { id: input.id },
        select: { id: true, key: true, type: true, isActive: true },
      });
      if (!client) return registryError("Channel client not found.", 404);
      if (!client.isActive) return registryError("Channel client is revoked.", 409);
      if (client.type !== "MACHINE") return registryError("Only MACHINE clients carry a machine key.", 400);

      const rotatedAt = new Date();
      await tx.channelClient.update({
        where: { id: client.id },
        data: {
          machineKeyBcrypt: secretHash,
          machineKeyHash: null,
          machineKeyIssuedAt: rotatedAt,
          machineKeyRotatedAt: rotatedAt,
          machineKeyExpiresAt: expiresAt,
        },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "channel_client.rotate_key",
          subjectType: "channel_client",
          subjectId: client.id,
          result: "rotated",
          metadataJson: { key: client.key, machineKeyExpiresAt: expiresAt.toISOString(), reason: input.reason ?? null },
        },
      });
      return { client: { id: client.id, key: client.key }, machineKey, openApiKey: formatOpenApiKey(client.key, machineKey), machineKeyExpiresAt: expiresAt };
    });
  } catch (error) {
    console.error("channel client key rotation failed:", error);
    return registryError("Rotation failed. No state was changed.", 500);
  }
}

/**
 * 更新时的配额语义：两者同给＝改写，两者同为 null＝回到全局默认，只给一半＝非法。
 * 与 `validateRateLimitConfig` 分开，是因为「未提供」和「显式清除」在这里是两种不同意图。
 */
export function validateRateLimitPatch(limit: number | null | undefined, windowMs: number | null | undefined): string | null {
  if (limit === undefined && windowMs === undefined) return null;
  if (limit === null && windowMs === null) return null;
  if (typeof limit !== "number" || typeof windowMs !== "number") {
    return "rateLimitLimit and rateLimitWindowMs must be sent together, or both as null to reset to the default.";
  }
  return validateRateLimitConfig(limit, windowMs);
}

export async function updateChannelClient(
  prisma: RegistryPrisma,
  input: {
    id: string;
    displayName?: string | undefined;
    allowedOrigins?: string[] | undefined;
    allowedScopes?: string[] | undefined;
    allowedIps?: string[] | undefined;
    rateLimitLimit?: number | null | undefined;
    rateLimitWindowMs?: number | null | undefined;
    actorUserId: string;
  },
): Promise<{ client: { id: string; key: string } } | RegistryError> {
  if (input.allowedScopes) {
    const scopeError = validateAllowedScopes(input.allowedScopes);
    if (scopeError) return registryError(scopeError, 400);
  }
  if (input.allowedOrigins) {
    const originError = validateAllowedOrigins(input.allowedOrigins);
    if (originError) return registryError(originError, 400);
  }
  if (input.allowedIps) {
    const ipError = validateAllowedIps(input.allowedIps);
    if (ipError) return registryError(ipError, 400);
  }
  const rateLimitError = validateRateLimitPatch(input.rateLimitLimit, input.rateLimitWindowMs);
  if (rateLimitError) return registryError(rateLimitError, 400);
  const patchesRateLimit = input.rateLimitLimit !== undefined || input.rateLimitWindowMs !== undefined;
  try {
    return await prisma.$transaction(async (tx) => {
      const client = await tx.channelClient.findUnique({ where: { id: input.id }, select: { id: true, key: true, isActive: true } });
      if (!client) return registryError("Channel client not found.", 404);
      if (!client.isActive) return registryError("Channel client is revoked.", 409);
      await tx.channelClient.update({
        where: { id: client.id },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.allowedOrigins !== undefined ? { allowedOrigins: input.allowedOrigins } : {}),
          ...(input.allowedScopes !== undefined ? { allowedScopes: input.allowedScopes } : {}),
          ...(input.allowedIps !== undefined ? { allowedIps: input.allowedIps } : {}),
          ...(patchesRateLimit
            ? { rateLimitLimit: input.rateLimitLimit ?? null, rateLimitWindowMs: input.rateLimitWindowMs ?? null }
            : {}),
        },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "channel_client.update",
          subjectType: "channel_client",
          subjectId: client.id,
          result: "updated",
          metadataJson: {
            displayName: input.displayName ?? null,
            allowedOrigins: input.allowedOrigins ?? null,
            allowedScopes: input.allowedScopes ?? null,
            allowedIps: input.allowedIps ?? null,
            rateLimit: patchesRateLimit ? { limit: input.rateLimitLimit ?? null, windowMs: input.rateLimitWindowMs ?? null } : null,
          },
        },
      });
      return { client: { id: client.id, key: client.key } };
    });
  } catch (error) {
    console.error("channel client update failed:", error);
    return registryError("Update failed. No state was changed.", 500);
  }
}

export async function revokeChannelClient(
  prisma: RegistryPrisma,
  input: { id: string; actorUserId: string; reason?: string | undefined },
): Promise<{ client: { id: string; key: string } } | RegistryError> {
  try {
    return await prisma.$transaction(async (tx) => {
      const client = await tx.channelClient.findUnique({ where: { id: input.id }, select: { id: true, key: true } });
      if (!client) return registryError("Channel client not found.", 404);
      const revokedAt = new Date();
      const updated = await tx.channelClient.updateMany({
        where: { id: client.id, isActive: true },
        data: { isActive: false, revokedAt, revokeReason: input.reason ?? null },
      });
      if (updated.count !== 1) return registryError("Channel client is already revoked.", 409);
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "channel_client.revoke",
          subjectType: "channel_client",
          subjectId: client.id,
          result: "revoked",
          metadataJson: { key: client.key, reason: input.reason ?? null, revokedAt: revokedAt.toISOString() },
        },
      });
      return { client: { id: client.id, key: client.key } };
    });
  } catch (error) {
    console.error("channel client revoke failed:", error);
    return registryError("Revoke failed. No state was changed.", 500);
  }
}
