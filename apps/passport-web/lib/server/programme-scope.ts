import type { PrismaClient } from "@prisma/client";

/**
 * V2.1 多 Programme scope 授权服务（CP-TODO-241 / CP-FR-050/051）。
 *
 * 判定顺序：默认拒绝；未知或不一致的 scope 拒绝；跨 Programme / 跨 Edition 拒绝；
 * 过期、撤销的授权拒绝；全局 UserRole（含 ADMIN）不自动获得 Programme 范围访问。
 * 任职/雇佣关系（PersonAffiliation、Organization.userId）不构成机构代表权，
 * 本服务不读取这些关系。
 */

export type ProgrammeScopeAction = "read" | "write" | "manage";

export interface ProgrammeScopeRef {
  programmeId: string;
  editionId?: string | null;
}

export interface ScopedAccessObject {
  objectType: string;
  objectId: string;
}

export type ScopedAccessDecision =
  | { allowed: true; via: "membership" | "object_authorization" | "institution_representation"; role: string | null }
  | { allowed: false; reason: "unknown_scope" | "no_active_grant" };

const MEMBERSHIP_ACTIONS: Record<string, ProgrammeScopeAction[]> = {
  PROGRAMME_ADMIN: ["read", "write", "manage"],
  PROGRAMME_OPERATOR: ["read", "write"],
  PROGRAMME_VIEWER: ["read"],
};

// Rank mirrors the ScopedAccessAction enum values stored in the database.
const ACTION_RANK: Record<string, number> = { READ: 1, WRITE: 2, MANAGE: 3 };

type PrismaLike = Pick<PrismaClient, "programme" | "edition" | "accessMembership" | "objectAuthorization" | "institutionRepresentation" | "sourceObjectMapping">;

function actionCovers(granted: string, requested: ProgrammeScopeAction) {
  const grantedRank = ACTION_RANK[granted];
  return grantedRank !== undefined && grantedRank >= ACTION_RANK[requested.toUpperCase()];
}

async function scopeIsResolvable(
  prisma: PrismaLike,
  scope: ProgrammeScopeRef,
  now: Date,
): Promise<boolean> {
  const programme = await prisma.programme.findFirst({
    where: { id: scope.programmeId, isActive: true },
    select: { id: true },
  });
  if (!programme) return false;

  if (!scope.editionId) return true;

  const edition = await prisma.edition.findFirst({
    where: { id: scope.editionId, isActive: true, archivedAt: null },
    select: { id: true, programmeId: true },
  });
  return Boolean(edition && edition.programmeId === scope.programmeId);
}

function activeWindowConditions(now: Date) {
  return {
    isActive: true,
    revokedAt: null,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    ],
  };
}

function editionCoverageConditions(editionId: string | null | undefined) {
  return editionId ? { OR: [{ editionId: null }, { editionId }] } : { editionId: null };
}

/**
 * 核心判定：actor 在 scope 内对 object 执行 action 是否被允许。默认拒绝。
 */
export async function resolveScopedAccess(
  prisma: PrismaLike,
  actor: { id: string } | null,
  scope: ProgrammeScopeRef,
  action: ProgrammeScopeAction,
  object: ScopedAccessObject | null = null,
): Promise<ScopedAccessDecision> {
  const now = new Date();

  if (!actor || !scope?.programmeId) {
    return { allowed: false, reason: "no_active_grant" };
  }

  if (!(await scopeIsResolvable(prisma, scope, now))) {
    return { allowed: false, reason: "unknown_scope" };
  }

  const memberships = await prisma.accessMembership.findMany({
    where: {
      userId: actor.id,
      programmeId: scope.programmeId,
      ...editionCoverageConditions(scope.editionId),
      ...activeWindowConditions(now),
    },
    select: { role: true },
  });
  if (memberships.some((membership) => (MEMBERSHIP_ACTIONS[membership.role] ?? []).includes(action))) {
    const best = memberships.find((membership) => (MEMBERSHIP_ACTIONS[membership.role] ?? []).includes(action));
    return { allowed: true, via: "membership", role: best?.role ?? null };
  }

  if (object) {
    const grant = await prisma.objectAuthorization.findFirst({
      where: {
        subjectUserId: actor.id,
        objectType: object.objectType,
        objectId: object.objectId,
        programmeId: scope.programmeId,
        ...editionCoverageConditions(scope.editionId),
        ...activeWindowConditions(now),
      },
      select: { action: true },
    });
    if (grant && actionCovers(grant.action, action)) {
      return { allowed: true, via: "object_authorization", role: grant.action };
    }

    if (object.objectType === "institution") {
      const representation = await prisma.institutionRepresentation.findFirst({
        where: {
          institutionId: object.objectId,
          userId: actor.id,
          programmeId: scope.programmeId,
          ...editionCoverageConditions(scope.editionId),
          ...activeWindowConditions(now),
          status: "ACTIVE",
        },
        select: { actionScope: true },
      });
      const requested = action.toUpperCase();
      if (representation && (representation.actionScope.includes(requested) || representation.actionScope.includes("MANAGE"))) {
        return { allowed: true, via: "institution_representation", role: null };
      }
    }
  }

  return { allowed: false, reason: "no_active_grant" };
}

/**
 * 活动当前的 scope 绑定：存在 ACTIVE 来源映射时返回其 Programme/Edition，否则返回 null
 * （无映射的既有对象为未接入 scope 的遗留对象，保持原行为）。
 */
export async function resolveActivityScope(
  prisma: PrismaLike,
  activityId: string,
): Promise<ProgrammeScopeRef | null> {
  const mapping = await prisma.sourceObjectMapping.findFirst({
    where: { activityId, applyStatus: "ACTIVE" },
    select: { programmeId: true, editionId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!mapping) return null;
  return { programmeId: mapping.programmeId, editionId: mapping.editionId };
}

/**
 * 供 API 路由使用的合成断言：未接入 scope 的对象直接放行；已接入 scope 的对象
 * 要求 actor 持有当前有效授权，匿名与越权一律 403。
 */
export async function assertActivityScopeAccess(
  prisma: PrismaLike,
  actor: { id: string } | null,
  activityId: string,
  action: ProgrammeScopeAction,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const scope = await resolveActivityScope(prisma, activityId);
  if (!scope) return { ok: true };
  if (!actor) return { ok: false, status: 403, error: "Forbidden" };

  const decision = await resolveScopedAccess(prisma, actor, scope, action, { objectType: "activity", objectId: activityId });
  if (!decision.allowed) return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true };
}
