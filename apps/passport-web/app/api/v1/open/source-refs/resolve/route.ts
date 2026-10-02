import { OpenApiSourceRefRequestSchema } from "@climate-passport/passport-contracts";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiDomainError, openApiInvalidRequest, openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";
import { resolveSourceRef } from "@/lib/server/source-ref-contracts";

export const OPTIONS = openApiOptions;

/**
 * CP-TODO-252 / CP-FR-071：通用 sourceRef 解析（白名单投影 + 内容哈希）。
 *
 * 来源系统固定为调用方自己的 clientKey，可见范围由该 key 的 Programme 决定：
 * body 里没有 system 字段可填，替别人解析在契约层就不成立。
 */
export async function POST(request: Request) {
  const gate = await requireOpenApiKey(request, { scope: "channel:source:resolve" });
  if (!gate.ok) return gate.response;

  const parsed = OpenApiSourceRefRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return openApiInvalidRequest(gate.requestId, parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const result = await resolveSourceRef(gate.prisma, {
    system: gate.client.key,
    objectType: parsed.data.objectType,
    objectId: parsed.data.objectId,
  });
  if ("error" in result) return openApiDomainError(gate.requestId, result);

  return openApiOk(gate, { ok: true, ...result });
}
