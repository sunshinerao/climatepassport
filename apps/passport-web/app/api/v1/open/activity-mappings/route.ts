import { SourceActivityBindSchema } from "@climate-passport/passport-contracts";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiDomainError, openApiInvalidRequest, openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";
import { assertOpenApiActivityBindable } from "@/lib/server/open-api-scope";
import { bindSourceActivity } from "@/lib/server/source-activity-mapping";

export const OPTIONS = openApiOptions;

/**
 * CP-TODO-245 / CP-FR-053：来源对象首次接入并绑定 CP 活动（幂等、唯一、并发安全）。
 *
 * 绑定即归属：成功之后这个活动在该 Programme 之外不可见，所以先把关——已属于别的
 * Programme 的活动不可抢占，也不回 403 承认它存在。
 */
export async function POST(request: Request) {
  const gate = await requireOpenApiKey(request, { scope: "channel:activities:source" });
  if (!gate.ok) return gate.response;

  const parsed = SourceActivityBindSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return openApiInvalidRequest(gate.requestId, parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const inScope = await assertOpenApiActivityBindable(gate.prisma, gate.client.programmeId, parsed.data.activityId);
  if (!inScope.ok) return openApiDomainError(gate.requestId, inScope.failure);

  const result = await bindSourceActivity(gate.prisma, {
    clientKey: gate.client.key,
    programmeId: gate.client.programmeId,
    editionId: parsed.data.editionId ?? null,
    sourceEditionRef: parsed.data.sourceEditionRef ?? null,
    sourceObjectId: parsed.data.sourceObjectId,
    activityId: parsed.data.activityId,
    authoritativeFields: parsed.data.authoritativeFields,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if ("error" in result) return openApiDomainError(gate.requestId, result);

  return openApiOk(gate, { mappingId: result.mappingId, deduplicated: result.deduplicated }, 201);
}
