import { ActivityTaxonomyWithdrawSchema } from "@climate-passport/passport-contracts";
import { withdrawActivityClassification } from "@/lib/server/activity-taxonomy";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiDomainError, openApiInvalidRequest, openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";
import { assertOpenApiActivityInProgramme } from "@/lib/server/open-api-scope";

export const OPTIONS = openApiOptions;

/**
 * CP-TODO-246：撤回活动分类引用（幂等；撤回后可用更高版本重新登记）。
 * 与登记走同一道 Programme 门：撤回是写操作，不能拿别的 Programme 的活动来试 id。
 */
export async function POST(request: Request) {
  const gate = await requireOpenApiKey(request, { scope: "channel:activities:source" });
  if (!gate.ok) return gate.response;

  const parsed = ActivityTaxonomyWithdrawSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return openApiInvalidRequest(gate.requestId, parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const inScope = await assertOpenApiActivityInProgramme(gate.prisma, gate.client.programmeId, parsed.data.activityId);
  if (!inScope.ok) return openApiDomainError(gate.requestId, inScope.failure);

  const result = await withdrawActivityClassification(gate.prisma, {
    activityId: parsed.data.activityId,
    taxonomySystem: parsed.data.taxonomySystem,
    taxonomyRef: parsed.data.taxonomyRef,
    sourceVersion: parsed.data.sourceVersion,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if ("error" in result) return openApiDomainError(gate.requestId, result);

  return openApiOk(gate, { classification: result.classification, deduplicated: result.deduplicated });
}
