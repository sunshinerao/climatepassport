import { ActivityTaxonomySetSchema } from "@climate-passport/passport-contracts";
import { setActivityClassification } from "@/lib/server/activity-taxonomy";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiDomainError, openApiInvalidRequest, openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";
import { assertOpenApiActivityInProgramme } from "@/lib/server/open-api-scope";

export const OPTIONS = openApiOptions;

/**
 * CP-TODO-246：登记活动分类版本投影（幂等 + 版本护栏）。
 *
 * `ActivityExternalClassification` 行本身没有 Programme 列，隔离只能靠活动：分类挂在
 * 哪个活动上，就归那个活动的 Programme 管，所以写入前必须证明该活动已接入本 Programme。
 */
export async function POST(request: Request) {
  const gate = await requireOpenApiKey(request, { scope: "channel:activities:source" });
  if (!gate.ok) return gate.response;

  const parsed = ActivityTaxonomySetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return openApiInvalidRequest(gate.requestId, parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const inScope = await assertOpenApiActivityInProgramme(gate.prisma, gate.client.programmeId, parsed.data.activityId);
  if (!inScope.ok) return openApiDomainError(gate.requestId, inScope.failure);

  const result = await setActivityClassification(gate.prisma, {
    activityId: parsed.data.activityId,
    taxonomySystem: parsed.data.taxonomySystem,
    taxonomyRef: parsed.data.taxonomyRef,
    labelJson: parsed.data.labelJson ?? null,
    sourceVersion: parsed.data.sourceVersion,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if ("error" in result) return openApiDomainError(gate.requestId, result);

  return openApiOk(gate, { classification: result.classification, deduplicated: result.deduplicated }, result.deduplicated ? 200 : 201);
}
