import { SourceActivityRevisionSchema } from "@climate-passport/passport-contracts";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiDomainError, openApiInvalidRequest, openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";
import { applySourceRevision } from "@/lib/server/source-activity-mapping";

export const OPTIONS = openApiOptions;

/**
 * CP-TODO-245：来源按版本序应用白名单字段修订；旧版本/同版本异内容一律 409。
 * 修订只认 `sourceSystem = 调用方自己的 key` 下的映射，跨 Programme 无从寻址。
 */
export async function POST(request: Request) {
  const gate = await requireOpenApiKey(request, { scope: "channel:activities:source" });
  if (!gate.ok) return gate.response;

  const parsed = SourceActivityRevisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return openApiInvalidRequest(gate.requestId, parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const result = await applySourceRevision(gate.prisma, {
    clientKey: gate.client.key,
    sourceObjectId: parsed.data.sourceObjectId,
    sourceEditionRef: parsed.data.sourceEditionRef ?? null,
    sourceVersion: parsed.data.sourceVersion,
    fields: parsed.data.fields,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if ("error" in result) return openApiDomainError(gate.requestId, result);

  return openApiOk(gate, { mappingId: result.mappingId, applied: result.applied });
}
