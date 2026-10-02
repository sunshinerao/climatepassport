import { resolveActivityScope } from "@/lib/server/programme-scope";
import type { OpenApiDomainFailure } from "@/lib/server/open-api-auth";

/**
 * Open API 的多 Programme 隔离断言。
 *
 * 这套端点原先只跑在内部双头通道上，调用方是自己人，跨 Programme 靠 clientKey 天然隔开。
 * 对外之后不成立：同一把 key 的能力要按 Programme 划定，任何一次对**具名对象**
 * （activityId / objectId）的读写都必须先证明该对象属于这把 key 的 Programme。
 *
 * 一律回 404 而不是 403：跨 Programme 探测得到 403 等于确认「那个 id 存在，只是在别人名下」。
 *
 * 活动与 Programme 之间目前只有 `SourceObjectMapping` 这一条边（见
 * programme-scope.ts:155），因此「未接入映射」在活动类断言里按不属于任何一方处理。
 */

type ScopePrisma = Parameters<typeof resolveActivityScope>[0];

function notInProgramme(object: string): OpenApiDomainFailure {
  return { status: 404, code: "SOURCE_MAPPING_NOT_FOUND", error: `${object} is not available to this programme.` };
}

/** 活动必须已绑定到该 Programme（已接入的对象），否则拒绝。 */
export async function assertOpenApiActivityInProgramme(
  prisma: ScopePrisma,
  programmeId: string,
  activityId: string,
): Promise<{ ok: true } | { ok: false; failure: OpenApiDomainFailure }> {
  const scope = await resolveActivityScope(prisma, activityId);
  if (!scope || scope.programmeId !== programmeId) return { ok: false, failure: notInProgramme("Activity") };
  return { ok: true };
}

/**
 * 绑定前的活动检查：尚未接入的活动可由本 Programme 绑定；已被别的 Programme 接入的
 * 活动不可抢占，也不可见。
 */
export async function assertOpenApiActivityBindable(
  prisma: ScopePrisma,
  programmeId: string,
  activityId: string,
): Promise<{ ok: true } | { ok: false; failure: OpenApiDomainFailure }> {
  const scope = await resolveActivityScope(prisma, activityId);
  if (scope && scope.programmeId !== programmeId) return { ok: false, failure: notInProgramme("Activity") };
  return { ok: true };
}
