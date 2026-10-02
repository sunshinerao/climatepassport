import { OpenApiWhoamiResponseSchema } from "@climate-passport/passport-contracts";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";

/** 预检与实调共用同一份来源判定。 */
export const OPTIONS = openApiOptions;

/**
 * Open API 密钥自省：只回调用方自己的身份、Programme 与已授予的 scope。
 * 它是排查「这把 key 到底能做什么」的第一个端点，不需要额外 scope。
 */
export async function GET(request: Request) {
  const gate = await requireOpenApiKey(request);
  if (!gate.ok) return gate.response;

  const body = OpenApiWhoamiResponseSchema.parse({
    ok: true,
    clientId: gate.client.id,
    clientKey: gate.client.key,
    displayName: gate.client.displayName,
    programmeId: gate.client.programmeId,
    scopes: gate.client.scopes,
    requestId: gate.requestId,
    rateLimit: {
      limit: gate.rateLimit.limit,
      windowMs: gate.rateLimit.windowMs,
      remaining: gate.rateLimit.remaining,
      resetAt: gate.rateLimit.resetAt,
    },
    key: {
      algorithm: gate.client.keyMeta.algorithm,
      issuedAt: gate.client.keyMeta.issuedAt?.toISOString() ?? null,
      expiresAt: gate.client.keyMeta.expiresAt?.toISOString() ?? null,
      rotatedAt: gate.client.keyMeta.rotatedAt?.toISOString() ?? null,
      lastUsedAt: gate.client.keyMeta.lastUsedAt?.toISOString() ?? null,
    },
    access: {
      allowedOrigins: gate.client.allowedOrigins,
      allowedIps: gate.client.allowedIps,
    },
  });
  return openApiOk(gate, body);
}
