import { SourceActivityCancelSchema } from "@climate-passport/passport-contracts";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiDomainError, openApiInvalidRequest, openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";
import { cancelSourceActivity } from "@/lib/server/source-activity-mapping";

export const OPTIONS = openApiOptions;

/**
 * CP-TODO-245：来源取消——优先关闭入口（活动 CANCELLED）并撤回全部已发布版本；幂等。
 * 取消范围同样以 `sourceSystem = 调用方自己的 key` 为界。
 */
export async function POST(request: Request) {
  const gate = await requireOpenApiKey(request, { scope: "channel:activities:source" });
  if (!gate.ok) return gate.response;

  const parsed = SourceActivityCancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return openApiInvalidRequest(gate.requestId, parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const result = await cancelSourceActivity(gate.prisma, {
    clientKey: gate.client.key,
    sourceObjectId: parsed.data.sourceObjectId,
    sourceEditionRef: parsed.data.sourceEditionRef ?? null,
    reason: parsed.data.reason ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if ("error" in result) return openApiDomainError(gate.requestId, result);

  return openApiOk(gate, result);
}
