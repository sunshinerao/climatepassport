/**
 * CP-TODO-253: person/institution contribution facts with evaluated verification
 * levels, correction chains and derived statistics (CP-FR-062).
 *
 * 原则：
 * - 计划/确认/实际/完成数量（quantities）与核验等级分开存储；等级单调可升不可降。
 * - 自报事实起点为 SELF_REPORTED；录入人身份（含 ADMIN）不自动升级为第三方核验，
 *   升级只能由与被记录人不同的授权评估人执行（自报不升级第三方核验）。
 * - 同一 (person, contributionType, sourceType, sourceId) 只允许一条 ACTIVE 事实
 *   （部分唯一索引 + 空来源显式查重），适配器与派生统计永不双计、不重复奖励。
 * - 更正生成 successor（correctionOfId 链），原行转 CORRECTED；撤回转 WITHDRAWN；
 *   派生统计只读 ACTIVE，更正/撤回即时复算（撤销可复算）。
 * - 机构可作为贡献主体（institutionId）；一人多角色/多来源事实并列存在互不覆盖
 *   （多角色不覆盖）；数值为按人计量，programme 不得把活动总量复制给每人。
 */

import type { Prisma, PrismaClient } from "@prisma/client";

export type ContributionError = { error: string; status: number; code: string };

export function contributionError(status: number, code: string, error: string): ContributionError {
  return { error, status, code };
}

type PrismaLike = Pick<
  PrismaClient,
  "contributionFact" | "person" | "institution" | "institutionRepresentation" | "accessMembership" | "coreAuditLog"
> & { $transaction: PrismaClient["$transaction"] };

export const CONTRIBUTION_FACT_STATUSES = ["ACTIVE", "CORRECTED", "WITHDRAWN"] as const;
export type ContributionFactStatusValue = (typeof CONTRIBUTION_FACT_STATUSES)[number];

export const CONTRIBUTION_VERIFICATION_LEVELS = [
  "UNVERIFIED",
  "SELF_REPORTED",
  "ORGANIZATION_CONFIRMED",
  "INDEPENDENTLY_VERIFIED",
] as const;
export type ContributionVerificationLevelValue = (typeof CONTRIBUTION_VERIFICATION_LEVELS)[number];

const LEVEL_RANK: Record<ContributionVerificationLevelValue, number> = {
  UNVERIFIED: 0,
  SELF_REPORTED: 1,
  ORGANIZATION_CONFIRMED: 2,
  INDEPENDENTLY_VERIFIED: 3,
};

export function contributionLevelRank(value: string): number {
  return LEVEL_RANK[value as ContributionVerificationLevelValue] ?? -1;
}

export type ContributionFactRow = {
  id: string;
  personId: string;
  institutionId: string | null;
  programmeId: string | null;
  contributionType: string;
  summaryJson: Prisma.JsonValue;
  verificationLevel: string;
  sourceType: string | null;
  sourceId: string | null;
  status: string;
  correctionOfId: string | null;
  createdById: string | null;
  occurredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function withinWindow(row: { validFrom: Date | null; validUntil: Date | null; revokedAt: Date | null }, now: Date) {
  if (row.revokedAt) return false;
  if (row.validFrom && row.validFrom.getTime() > now.getTime()) return false;
  if (row.validUntil && row.validUntil.getTime() <= now.getTime()) return false;
  return true;
}

async function loadActorPersonId(prisma: Pick<PrismaClient, "person">, userId: string): Promise<string | null> {
  const actorPerson = await prisma.person.findUnique({ where: { userId }, select: { id: true } });
  return actorPerson?.id ?? null;
}

/** 机构 MANAGE 代表权（有效窗口内、actionScope 含 MANAGE）。 */
async function hasInstitutionManage(
  prisma: Pick<PrismaClient, "institutionRepresentation">,
  userId: string,
  institutionId: string
): Promise<boolean> {
  const rows = await prisma.institutionRepresentation.findMany({
    where: { userId, institutionId, status: "ACTIVE" },
  });
  const now = new Date();
  return rows.some((row) => row.actionScope.includes("MANAGE") && withinWindow(row, now));
}

/** Programme 成员（PROGRAMME_ADMIN / PROGRAMME_OPERATOR 为管理面，VIEWER 仅读取面）。 */
async function hasProgrammeRole(
  prisma: Pick<PrismaClient, "accessMembership">,
  userId: string,
  programmeId: string,
  roles: string[]
): Promise<boolean> {
  const rows = await prisma.accessMembership.findMany({ where: { userId, programmeId, isActive: true } });
  const now = new Date();
  return rows.some((row) => roles.includes(row.role) && withinWindow(row, now));
}

async function canAdministerFact(
  prisma: Pick<PrismaClient, "institutionRepresentation" | "accessMembership">,
  actor: { id: string; role: string },
  fact: { institutionId: string | null; programmeId: string | null }
): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (fact.institutionId && (await hasInstitutionManage(prisma, actor.id, fact.institutionId))) return true;
  if (fact.programmeId && (await hasProgrammeRole(prisma, actor.id, fact.programmeId, ["PROGRAMME_ADMIN", "PROGRAMME_OPERATOR"]))) return true;
  return false;
}

async function findActiveDuplicate(
  prisma: Pick<PrismaClient, "contributionFact">,
  key: { personId: string; contributionType: string; sourceType: string | null; sourceId: string | null }
) {
  return prisma.contributionFact.findFirst({
    where: {
      personId: key.personId,
      contributionType: key.contributionType,
      sourceType: key.sourceType,
      sourceId: key.sourceId,
      status: "ACTIVE",
    },
  });
}

function factSummary(
  input: { quantities?: Record<string, unknown> | null; note?: string | null }
): Prisma.InputJsonValue {
  return {
    quantities: input.quantities ?? {},
    ...(input.note ? { note: input.note } : {}),
  } as Prisma.InputJsonValue;
}

export async function recordContributionFact(
  prisma: PrismaLike,
  input: {
    personId: string;
    contributionType: string;
    institutionId?: string | null;
    programmeId?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    occurredAt?: Date | null;
    quantities?: Record<string, unknown> | null;
    note?: string | null;
  },
  actor: { id: string; role: string }
): Promise<{ fact: ContributionFactRow } | ContributionError> {
  const person = await prisma.person.findUnique({ where: { id: input.personId }, select: { id: true } });
  if (!person) return contributionError(404, "CONTRIBUTION_NOT_FOUND", "Person not found");
  if (input.institutionId) {
    const institution = await prisma.institution.findUnique({ where: { id: input.institutionId }, select: { id: true } });
    if (!institution) return contributionError(404, "CONTRIBUTION_NOT_FOUND", "Institution not found");
  }

  const actorPersonId = await loadActorPersonId(prisma, actor.id);
  const administering = await canAdministerFact(prisma, actor, {
    institutionId: input.institutionId ?? null,
    programmeId: input.programmeId ?? null,
  });
  if (actor.role !== "ADMIN" && !administering && actorPersonId !== input.personId) {
    return contributionError(403, "CONTRIBUTION_ACCESS_DENIED", "Cannot record contribution facts for another person");
  }
  if (input.programmeId && actor.role !== "ADMIN" && !(await hasProgrammeRole(prisma, actor.id, input.programmeId, ["PROGRAMME_ADMIN", "PROGRAMME_OPERATOR", "PROGRAMME_VIEWER"]))) {
    return contributionError(403, "CONTRIBUTION_ACCESS_DENIED", "Not a member of the target programme");
  }

  const key = {
    personId: input.personId,
    contributionType: input.contributionType,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
  };
  const duplicate = await findActiveDuplicate(prisma, key);
  if (duplicate) {
    return contributionError(409, "CONTRIBUTION_CONFLICT", "An ACTIVE contribution fact already exists for this person, type and source");
  }

  try {
    const fact = await prisma.$transaction(async (tx) => {
      const row = await tx.contributionFact.create({
        data: {
          personId: input.personId,
          institutionId: input.institutionId ?? null,
          programmeId: input.programmeId ?? null,
          contributionType: input.contributionType,
          summaryJson: factSummary(input),
          verificationLevel: "SELF_REPORTED",
          sourceType: key.sourceType,
          sourceId: key.sourceId,
          status: "ACTIVE",
          occurredAt: input.occurredAt ?? null,
          createdById: actor.id,
        },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: actor.id,
          action: "contribution.record",
          subjectType: "ContributionFact",
          subjectId: row.id,
          result: "SUCCESS",
          metadataJson: { ...key, verificationLevel: "SELF_REPORTED" },
        },
      });
      return row;
    });
    return { fact };
  } catch (error) {
    // 并发同键录入：唯一索引竞争失败者转显式冲突。
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return contributionError(409, "CONTRIBUTION_CONFLICT", "An ACTIVE contribution fact already exists for this person, type and source");
    }
    throw error;
  }
}

export async function evaluateContributionFact(
  prisma: PrismaLike,
  input: { factId: string; verificationLevel: string; reason: string },
  actor: { id: string; role: string }
): Promise<{ fact: ContributionFactRow; upgraded: boolean } | ContributionError> {
  const fact = await prisma.contributionFact.findUnique({ where: { id: input.factId } });
  if (!fact) return contributionError(404, "CONTRIBUTION_NOT_FOUND", "Contribution fact not found");
  if (fact.status !== "ACTIVE") {
    return contributionError(409, "CONTRIBUTION_CONFLICT", `A ${fact.status} fact can no longer be evaluated`);
  }

  const nextRank = contributionLevelRank(input.verificationLevel);
  const currentRank = contributionLevelRank(fact.verificationLevel);
  if (nextRank < 0) {
    return contributionError(400, "CONTRIBUTION_VERIFICATION_INVALID", `verificationLevel must be one of: ${CONTRIBUTION_VERIFICATION_LEVELS.join(", ")}`);
  }
  if (nextRank === currentRank) return { fact: fact as ContributionFactRow, upgraded: false };
  if (nextRank < currentRank) {
    return contributionError(409, "CONTRIBUTION_VERIFICATION_INVALID", `verificationLevel cannot regress from ${fact.verificationLevel} to ${input.verificationLevel}`);
  }

  // 自报不升级第三方核验：被记录人本人（非 ADMIN）不得评估自己的事实。
  const actorPersonId = await loadActorPersonId(prisma, actor.id);
  if (actor.role !== "ADMIN" && actorPersonId && actorPersonId === fact.personId) {
    return contributionError(403, "CONTRIBUTION_ACCESS_DENIED", "A person cannot evaluate their own contribution fact");
  }
  if (!(await canAdministerFact(prisma, actor, fact))) {
    return contributionError(403, "CONTRIBUTION_ACCESS_DENIED", "Not authorized to evaluate this contribution fact");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.contributionFact.updateMany({
      where: { id: fact.id, status: "ACTIVE", verificationLevel: fact.verificationLevel },
      data: { verificationLevel: input.verificationLevel },
    });
    if (result.count !== 1) {
      throw new Error("contribution evaluation lost a concurrent update");
    }
    const row = await tx.contributionFact.findUniqueOrThrow({ where: { id: fact.id } });
    await tx.coreAuditLog.create({
      data: {
        actorUserId: actor.id,
        action: "contribution.evaluate",
        subjectType: "ContributionFact",
        subjectId: row.id,
        result: "SUCCESS",
        metadataJson: {
          fromLevel: fact.verificationLevel,
          toLevel: input.verificationLevel,
          reason: input.reason,
          personId: fact.personId,
        },
      },
    });
    return row;
  });
  return { fact: updated as ContributionFactRow, upgraded: true };
}

export async function correctContributionFact(
  prisma: PrismaLike,
  input: { factId: string; quantities?: Record<string, unknown> | null; note?: string | null; reason: string },
  actor: { id: string; role: string }
): Promise<{ fact: ContributionFactRow; correctedFactId: string } | ContributionError> {
  const fact = await prisma.contributionFact.findUnique({ where: { id: input.factId } });
  if (!fact) return contributionError(404, "CONTRIBUTION_NOT_FOUND", "Contribution fact not found");
  if (fact.status !== "ACTIVE") {
    return contributionError(409, "CONTRIBUTION_CONFLICT", `A ${fact.status} fact can no longer be corrected`);
  }

  const actorPersonId = await loadActorPersonId(prisma, actor.id);
  const administering = await canAdministerFact(prisma, actor, fact);
  if (actor.role !== "ADMIN" && !administering && actorPersonId !== fact.personId) {
    return contributionError(403, "CONTRIBUTION_ACCESS_DENIED", "Cannot correct this contribution fact");
  }

  // 本人更正回到自报等级；授权管理面更正保留原核验等级。
  const successorLevel = administering ? fact.verificationLevel : "SELF_REPORTED";
  const summary = fact.summaryJson as { quantities?: Record<string, unknown>; note?: string };

  try {
    const successor = await prisma.$transaction(async (tx) => {
      const corrected = await tx.contributionFact.updateMany({
        where: { id: fact.id, status: "ACTIVE" },
        data: { status: "CORRECTED" },
      });
      if (corrected.count !== 1) {
        throw new Error("contribution correction lost a concurrent update");
      }
      const row = await tx.contributionFact.create({
        data: {
          personId: fact.personId,
          institutionId: fact.institutionId,
          programmeId: fact.programmeId,
          contributionType: fact.contributionType,
          summaryJson: factSummary({ quantities: input.quantities ?? summary.quantities ?? {}, note: input.note ?? summary.note ?? null }),
          verificationLevel: successorLevel,
          sourceType: fact.sourceType,
          sourceId: fact.sourceId,
          status: "ACTIVE",
          correctionOfId: fact.id,
          occurredAt: fact.occurredAt,
          createdById: actor.id,
        },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: actor.id,
          action: "contribution.correct",
          subjectType: "ContributionFact",
          subjectId: row.id,
          result: "SUCCESS",
          metadataJson: { correctedOfId: fact.id, reason: input.reason, successorLevel, personId: fact.personId },
        },
      });
      return row;
    });
    return { fact: successor as ContributionFactRow, correctedFactId: fact.id };
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return contributionError(409, "CONTRIBUTION_CONFLICT", "A correction already superseded this fact");
    }
    if (error instanceof Error && /concurrent update/.test(error.message)) {
      return contributionError(409, "CONTRIBUTION_CONFLICT", "Fact was updated concurrently; retry the correction");
    }
    throw error;
  }
}

export async function withdrawContributionFact(
  prisma: PrismaLike,
  input: { factId: string; reason: string },
  actor: { id: string; role: string }
): Promise<{ fact: ContributionFactRow; withdrawn: boolean } | ContributionError> {
  const fact = await prisma.contributionFact.findUnique({ where: { id: input.factId } });
  if (!fact) return contributionError(404, "CONTRIBUTION_NOT_FOUND", "Contribution fact not found");
  if (fact.status === "WITHDRAWN") return { fact: fact as ContributionFactRow, withdrawn: false };
  if (fact.status !== "ACTIVE") {
    return contributionError(409, "CONTRIBUTION_CONFLICT", `A ${fact.status} fact can no longer be withdrawn`);
  }

  const actorPersonId = await loadActorPersonId(prisma, actor.id);
  if (actor.role !== "ADMIN" && !(await canAdministerFact(prisma, actor, fact)) && actorPersonId !== fact.personId) {
    return contributionError(403, "CONTRIBUTION_ACCESS_DENIED", "Cannot withdraw this contribution fact");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const withdrawn = await tx.contributionFact.updateMany({
      where: { id: fact.id, status: "ACTIVE" },
      data: { status: "WITHDRAWN" },
    });
    if (withdrawn.count !== 1) {
      throw new Error("contribution withdrawal lost a concurrent update");
    }
    const row = await tx.contributionFact.findUniqueOrThrow({ where: { id: fact.id } });
    await tx.coreAuditLog.create({
      data: {
        actorUserId: actor.id,
        action: "contribution.withdraw",
        subjectType: "ContributionFact",
        subjectId: row.id,
        result: "SUCCESS",
        metadataJson: { reason: input.reason, personId: fact.personId },
      },
    });
    return row;
  });
  return { fact: updated as ContributionFactRow, withdrawn: true };
}

export async function listContributionFacts(
  prisma: Pick<PrismaClient, "contributionFact">,
  filter: { personId?: string; institutionId?: string },
  options: { includeHistory?: boolean } = {}
): Promise<{ facts: ContributionFactRow[] }> {
  const facts = await prisma.contributionFact.findMany({
    where: {
      ...(filter.personId ? { personId: filter.personId } : {}),
      ...(filter.institutionId ? { institutionId: filter.institutionId } : {}),
      ...(options.includeHistory ? {} : { status: "ACTIVE" }),
    },
    orderBy: [{ contributionType: "asc" }, { createdAt: "asc" }],
  });
  return { facts: facts as ContributionFactRow[] };
}

/**
 * 派生统计（撤销可复算）：只聚合 ACTIVE 行；数值按人计量求和，多角色/多来源
 * 事实并列计入 factCount，但 distinctPersons 按人去重——绝不双计。
 */
export async function contributionStats(
  prisma: Pick<PrismaClient, "contributionFact">,
  filter: { personId?: string; institutionId?: string; programmeId?: string }
): Promise<{
  totalFacts: number;
  distinctPersons: number;
  byType: Array<{ contributionType: string; factCount: number; distinctPersons: number; quantities: Record<string, number> }>;
  byVerificationLevel: Record<string, number>;
}> {
  const rows = await prisma.contributionFact.findMany({
    where: {
      status: "ACTIVE",
      ...(filter.personId ? { personId: filter.personId } : {}),
      ...(filter.institutionId ? { institutionId: filter.institutionId } : {}),
      ...(filter.programmeId ? { programmeId: filter.programmeId } : {}),
    },
  });

  const typeMap = new Map<string, { factCount: number; persons: Set<string>; quantities: Record<string, number> }>();
  const levelCounts: Record<string, number> = {};
  const allPersons = new Set<string>();

  for (const row of rows) {
    allPersons.add(row.personId);
    levelCounts[row.verificationLevel] = (levelCounts[row.verificationLevel] ?? 0) + 1;
    const entry = typeMap.get(row.contributionType) ?? { factCount: 0, persons: new Set(), quantities: {} };
    entry.factCount += 1;
    entry.persons.add(row.personId);
    const quantities = (row.summaryJson as { quantities?: Record<string, unknown> })?.quantities ?? {};
    for (const [key, value] of Object.entries(quantities)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        entry.quantities[key] = (entry.quantities[key] ?? 0) + value;
      }
    }
    typeMap.set(row.contributionType, entry);
  }

  return {
    totalFacts: rows.length,
    distinctPersons: allPersons.size,
    byType: [...typeMap.entries()].map(([contributionType, entry]) => ({
      contributionType,
      factCount: entry.factCount,
      distinctPersons: entry.persons.size,
      quantities: entry.quantities,
    })),
    byVerificationLevel: levelCounts,
  };
}
