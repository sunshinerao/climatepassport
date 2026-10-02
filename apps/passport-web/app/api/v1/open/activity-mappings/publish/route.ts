import { SourceActivityPublishSchema } from "@climate-passport/passport-contracts";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiDomainError, openApiInvalidRequest, openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";
import { publishSourceActivity } from "@/lib/server/source-activity-mapping";

export const OPTIONS = openApiOptions;

/**
 * CP-TODO-245：来源发布活动投影版本（不可变、幂等、撤回版本禁止复活）。
 *
 * 不需要额外的 Programme 断言：版本按 `sourceSystem = 调用方自己的 key` 定位映射行，
 * 一把 key 只能发布自己接入的对象。
 */
export async function POST(request: Request) {
  const gate = await requireOpenApiKey(request, { scope: "channel:activities:source" });
  if (!gate.ok) return gate.response;

  const parsed = SourceActivityPublishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return openApiInvalidRequest(gate.requestId, parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const result = await publishSourceActivity(gate.prisma, {
    clientKey: gate.client.key,
    sourceObjectId: parsed.data.sourceObjectId,
    sourceEditionRef: parsed.data.sourceEditionRef ?? null,
    sourceVersion: parsed.data.sourceVersion,
    projectionJson: parsed.data.projectionJson,
    channel: parsed.data.channel ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if ("error" in result) return openApiDomainError(gate.requestId, result);

  return openApiOk(gate, { publicationId: result.publicationId, deduplicated: result.deduplicated }, 201);
}
