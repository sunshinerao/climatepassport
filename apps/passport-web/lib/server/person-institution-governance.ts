import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * CP-TODO-242：Person 认领 / 机构代表权 / 合并别名 / 授权投影（CP-FR-051/052）。
 *
 * 原则：
 * - 任职/雇佣关系（PersonAffiliation）不构成机构代表权；本服务判定代表权
 *   只读取 InstitutionRepresentation，不读取任何任职关系。
 * - 认领（claim）只把已确认（VERIFIED）且未关联账号的 Person 绑定到既有账号，
 *   不自动开户、不发送邀请。
 * - 合并保留源记录并建立 mergedIntoId 链，原引用（旧 id / 旧 slug）始终可解析。
 * - 关键写入与审计同事务提交（CP-AUD-005）。
 */

const MERGE_CHAIN_LIMIT = 10;
const CLAIMABLE_PERSON_STATUSES = ["VERIFIED"] as const;
const REPRESENTATION_ACTIONS = ["READ", "WRITE", "MANAGE"] as const;

export type GovernanceError = { error: string; status: number };

type PrismaLike = Pick<PrismaClient,
  | "person"
  | "institution"
  | "user"
  | "programme"
  | "edition"
  | "institutionRepresentation"
  | "personAffiliation"
  | "personRoleProfile"
  | "speaker"
  | "activityInstitution"
  | "eventInstitution"
  | "coreAuditLog"> & {
    $transaction: PrismaClient["$transaction"];
  };

type ChainReader = Pick<PrismaClient, "person" | "institution">;
type RepresentationReader = Pick<PrismaClient, "institutionRepresentation">;

function governanceError(error: string, status: number): GovernanceError {
  return { error, status };
}

function representationWindowConditions(now: Date) {
  return {
    revokedAt: null,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    ],
  };
}

async function resolveChain(
  prisma: ChainReader,
  model: "person" | "institution",
  id: string,
  depth = 0,
): Promise<string | null> {
  if (depth >= MERGE_CHAIN_LIMIT) return null;
  const record = model === "person"
    ? await prisma.person.findUnique({ where: { id }, select: { mergedIntoId: true } })
    : await prisma.institution.findUnique({ where: { id }, select: { mergedIntoId: true } });
  if (!record) return null;
  if (!record.mergedIntoId) return id;
  return resolveChain(prisma, model, record.mergedIntoId, depth + 1);
}

/** 旧 Person 引用（合并后的源 id）解析到规范记录 id；不存在或成环返回 null。 */
export async function resolvePersonId(prisma: ChainReader, personId: string): Promise<string | null> {
  return resolveChain(prisma, "person", personId);
}

/** 旧 Institution 引用解析到规范记录 id；不存在或成环返回 null。 */
export async function resolveInstitutionId(prisma: ChainReader, institutionId: string): Promise<string | null> {
  return resolveChain(prisma, "institution", institutionId);
}

/**
 * 机构代表权判定：仅依据 InstitutionRepresentation（ACTIVE + 有效期窗口 +
 * actionScope 覆盖，MANAGE 覆盖全部动作）。任职关系不参与（CP-FR-051）。
 */
export async function resolveInstitutionRepresentation(
  prisma: RepresentationReader,
  input: { userId: string; institutionId: string; action: "read" | "write" | "manage" },
): Promise<{ granted: true; representationId: string } | { granted: false }> {
  const now = new Date();
  const representation = await prisma.institutionRepresentation.findFirst({
    where: {
      institutionId: input.institutionId,
      userId: input.userId,
      status: "ACTIVE",
      ...representationWindowConditions(now),
    },
    select: { id: true, actionScope: true },
    orderBy: { createdAt: "asc" },
  });
  if (!representation) return { granted: false };
  const requested = input.action.toUpperCase();
  if (representation.actionScope.includes(requested) || representation.actionScope.includes("MANAGE")) {
    return { granted: true, representationId: representation.id };
  }
  return { granted: false };
}

/** 认领：把已确认、未关联账号的 Person 绑定到既有账号；不开户、不发邀请。 */
export async function claimPersonForUser(
  prisma: PrismaLike,
  input: { personId: string; userId: string; actorUserId: string },
): Promise<{ personId: string; userId: string } | GovernanceError> {
  try {
    return await prisma.$transaction(async (tx) => {
      const person = await tx.person.findUnique({
        where: { id: input.personId },
        select: { id: true, userId: true, verificationStatus: true, mergedIntoId: true },
      });
      if (!person) return governanceError("Person not found.", 404);
      if (person.mergedIntoId) return governanceError("Person record was merged; claim the canonical record instead.", 409);
      if (person.userId) return governanceError("Person is already linked to an account.", 409);
      if (!(CLAIMABLE_PERSON_STATUSES as readonly string[]).includes(person.verificationStatus)) {
        return governanceError("Only verified person records can be claimed.", 409);
      }
      const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true } });
      if (!user) return governanceError("Account not found.", 404);
      const existingClaim = await tx.person.findFirst({ where: { userId: input.userId }, select: { id: true } });
      if (existingClaim) return governanceError("Account is already linked to another person record.", 409);

      const updated = await tx.person.update({
        where: { id: person.id },
        data: { userId: input.userId },
        select: { id: true },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "person.claim",
          subjectType: "person",
          subjectId: person.id,
          result: "claimed",
          metadataJson: { userId: input.userId },
        },
      });
      return { personId: updated.id, userId: input.userId };
    });
  } catch (error) {
    console.error("person claim failed:", error);
    return governanceError("Claim failed. No state was changed.", 500);
  }
}

/** 授予机构代表权： Always lands on the canonical (post-merge) institution record. */
export async function grantInstitutionRepresentation(
  prisma: PrismaLike,
  input: {
    institutionId: string;
    userId: string;
    programmeId: string;
    editionId?: string | null;
    actionScope: string[];
    validFrom?: Date | null;
    validUntil?: Date | null;
    basis?: Record<string, unknown> | null;
    actorUserId: string;
  },
): Promise<{ representationId: string } | GovernanceError> {
  const actionScope = [...new Set(input.actionScope.map((action) => action.toUpperCase()))];
  if (actionScope.length === 0 || actionScope.some((action) => !(REPRESENTATION_ACTIONS as readonly string[]).includes(action))) {
    return governanceError(`actionScope must be a non-empty subset of ${REPRESENTATION_ACTIONS.join("/")}.`, 400);
  }
  if (input.validFrom && input.validUntil && input.validUntil <= input.validFrom) {
    return governanceError("validUntil must be after validFrom.", 400);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const institutionId = await resolveInstitutionId(tx, input.institutionId);
      if (!institutionId) return governanceError("Institution not found.", 404);
      const [institution, targetUser, programme] = await Promise.all([
        tx.institution.findUnique({ where: { id: institutionId }, select: { id: true } }),
        tx.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
        tx.programme.findFirst({ where: { id: input.programmeId, isActive: true }, select: { id: true } }),
      ]);
      if (!institution) return governanceError("Institution not found.", 404);
      if (!targetUser) return governanceError("Account not found.", 404);
      if (!programme) return governanceError("Programme not found or inactive.", 404);
      if (input.editionId) {
        const edition = await tx.edition.findFirst({
          where: { id: input.editionId, programmeId: input.programmeId, isActive: true, archivedAt: null },
          select: { id: true },
        });
        if (!edition) return governanceError("Edition does not belong to the programme or is archived.", 409);
      }

      const representation = await tx.institutionRepresentation.create({
        data: {
          institutionId: institution.id,
          userId: input.userId,
          programmeId: input.programmeId,
          editionId: input.editionId ?? null,
          actionScope,
          validFrom: input.validFrom ?? null,
          validUntil: input.validUntil ?? null,
          basisJson: (input.basis ?? undefined) as Prisma.InputJsonValue | undefined,
          grantorUserId: input.actorUserId,
        },
        select: { id: true },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "institution_representation.grant",
          subjectType: "institution",
          subjectId: institution.id,
          result: "granted",
          metadataJson: {
            representationId: representation.id,
            userId: input.userId,
            programmeId: input.programmeId,
            editionId: input.editionId ?? null,
            actionScope,
          },
        },
      });
      return { representationId: representation.id };
    });
  } catch (error) {
    console.error("institution representation grant failed:", error);
    return governanceError("Grant failed. No state was changed.", 500);
  }
}

/** 撤销机构代表权：compare-and-set，撤销立即生效（CP-FR-051 撤权后旧访问不能继续）。 */
export async function revokeInstitutionRepresentation(
  prisma: PrismaLike,
  input: { representationId: string; actorUserId: string; reason?: string },
): Promise<{ representationId: string } | GovernanceError> {
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.institutionRepresentation.findUnique({
        where: { id: input.representationId },
        select: { id: true, institutionId: true, status: true },
      });
      if (!current) return governanceError("Representation not found.", 404);
      const updated = await tx.institutionRepresentation.updateMany({
        where: { id: current.id, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: new Date(), revokedByUserId: input.actorUserId },
      });
      if (updated.count !== 1) return governanceError("Representation is no longer active.", 409);
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "institution_representation.revoke",
          subjectType: "institution",
          subjectId: current.institutionId,
          result: "revoked",
          metadataJson: { representationId: current.id, reason: input.reason ?? null },
        },
      });
      return { representationId: current.id };
    });
  } catch (error) {
    console.error("institution representation revoke failed:", error);
    return governanceError("Revoke failed. No state was changed.", 500);
  }
}

/** 合并 Person 重复记录：源记录保留为别名，全部引用迁移到规范记录。 */
export async function mergePersonRecords(
  prisma: PrismaLike,
  input: { targetId: string; sourceId: string; actorUserId: string },
): Promise<{ personId: string } | GovernanceError> {
  if (input.targetId === input.sourceId) return governanceError("Cannot merge a record into itself.", 400);
  try {
    return await prisma.$transaction(async (tx) => {
      const [targetId, sourceId] = await Promise.all([
        resolvePersonId(tx, input.targetId),
        resolvePersonId(tx, input.sourceId),
      ]);
      if (!targetId || !sourceId) return governanceError("Person not found.", 404);
      if (targetId === sourceId) return governanceError("Records already resolve to the same person.", 409);

      const [target, source] = await Promise.all([
        tx.person.findUnique({ where: { id: targetId }, select: { id: true, userId: true } }),
        tx.person.findUnique({ where: { id: sourceId }, select: { id: true, userId: true } }),
      ]);
      if (!target || !source) return governanceError("Person not found.", 404);
      if (target.userId && source.userId && target.userId !== source.userId) {
        return governanceError("Both person records are linked to different accounts; unlink one before merging.", 409);
      }

      await tx.speaker.updateMany({ where: { personId: sourceId }, data: { personId: targetId } });
      await tx.personAffiliation.updateMany({ where: { personId: sourceId }, data: { personId: targetId } });
      await tx.personRoleProfile.updateMany({ where: { personId: sourceId }, data: { personId: targetId } });
      if (!target.userId && source.userId) {
        await tx.person.update({ where: { id: targetId }, data: { userId: source.userId } });
        await tx.person.update({ where: { id: sourceId }, data: { userId: null } });
      }
      await tx.person.update({ where: { id: sourceId }, data: { mergedIntoId: targetId } });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "person.merge",
          subjectType: "person",
          subjectId: targetId,
          result: "merged",
          metadataJson: { sourcePersonId: sourceId },
        },
      });
      return { personId: targetId };
    });
  } catch (error) {
    console.error("person merge failed:", error);
    return governanceError("Merge failed. No state was changed.", 500);
  }
}

/** 合并 Institution 重复记录：别名并入、引用迁移、源记录保留可解析。 */
export async function mergeInstitutionRecords(
  prisma: PrismaLike,
  input: { targetId: string; sourceId: string; actorUserId: string },
): Promise<{ institutionId: string } | GovernanceError> {
  if (input.targetId === input.sourceId) return governanceError("Cannot merge a record into itself.", 400);
  try {
    return await prisma.$transaction(async (tx) => {
      const [targetId, sourceId] = await Promise.all([
        resolveInstitutionId(tx, input.targetId),
        resolveInstitutionId(tx, input.sourceId),
      ]);
      if (!targetId || !sourceId) return governanceError("Institution not found.", 404);
      if (targetId === sourceId) return governanceError("Records already resolve to the same institution.", 409);

      const [target, source] = await Promise.all([
        tx.institution.findUnique({ where: { id: targetId }, select: { id: true, aliases: true } }),
        tx.institution.findUnique({ where: { id: sourceId }, select: { id: true, slug: true, aliases: true } }),
      ]);
      if (!target || !source) return governanceError("Institution not found.", 404);

      await tx.activityInstitution.updateMany({ where: { institutionId: sourceId }, data: { institutionId: targetId } });
      await tx.eventInstitution.updateMany({ where: { institutionId: sourceId }, data: { institutionId: targetId } });
      await tx.personAffiliation.updateMany({ where: { institutionId: sourceId }, data: { institutionId: targetId } });
      await tx.personRoleProfile.updateMany({ where: { scopeInstitutionId: sourceId }, data: { scopeInstitutionId: targetId } });
      await tx.institutionRepresentation.updateMany({ where: { institutionId: sourceId }, data: { institutionId: targetId } });
      await tx.institution.updateMany({ where: { parentInstitutionId: sourceId }, data: { parentInstitutionId: targetId } });

      const mergedAliases = [...new Set([...target.aliases, source.slug, ...source.aliases])];
      await tx.institution.update({ where: { id: targetId }, data: { aliases: mergedAliases } });
      await tx.institution.update({ where: { id: sourceId }, data: { mergedIntoId: targetId, isActive: false } });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "institution.merge",
          subjectType: "institution",
          subjectId: targetId,
          result: "merged",
          metadataJson: { sourceInstitutionId: sourceId, mergedAliases },
        },
      });
      return { institutionId: targetId };
    });
  } catch (error) {
    console.error("institution merge failed:", error);
    return governanceError("Merge failed. No state was changed.", 500);
  }
}

/** 用途受限投影：角色展示只返回用途许可字段，不提供全量正文（CP-FR-051/052）。 */
const INSTITUTION_PROJECTION_FIELDS = [
  "id", "slug", "name", "nameEn", "shortName", "shortNameEn",
  "logo", "website", "countryOrRegion", "countryOrRegionEn", "verificationStatus",
] as const;

const PERSON_PROJECTION_FIELDS = [
  "id", "slug", "displayName", "displayNameEn", "avatar",
  "countryOrRegion", "countryOrRegionEn", "verificationStatus",
] as const;

export function projectInstitutionForPurpose(
  institution: Record<string, unknown>,
  purpose: string,
): Record<string, unknown> | null {
  if (purpose !== "institution_context") return null;
  return Object.fromEntries(INSTITUTION_PROJECTION_FIELDS.filter((field) => field in institution).map((field) => [field, institution[field]]));
}

export function projectPersonForPurpose(
  person: Record<string, unknown>,
  purpose: string,
): Record<string, unknown> | null {
  if (purpose !== "person_identity") return null;
  return Object.fromEntries(PERSON_PROJECTION_FIELDS.filter((field) => field in person).map((field) => [field, person[field]]));
}
