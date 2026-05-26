import { randomBytes } from "crypto";
import type {
  AchievementSourceType,
  AchievementStatus,
  AchievementType,
  AchievementVerificationLevel,
  BadgeAwardStatus,
  BadgeCategory,
  BadgeLevel,
  BadgeVerificationGrade,
  Prisma,
} from "@prisma/client";
import { grantUserPoints } from "@/lib/server/point-ledger";
import { getPrismaClient } from "@/lib/server/prisma";

function getRuntimeModel<T>(prisma: unknown, key: string): T | null {
  if (!prisma || typeof prisma !== "object") {
    return null;
  }

  const candidate = (prisma as Record<string, unknown>)[key];
  return candidate ? (candidate as T) : null;
}

function isMissingTableError(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "P2021",
  );
}

export const MVP_BADGE_DEFINITIONS: Array<{
  code: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  category: BadgeCategory;
  level: BadgeLevel;
  verificationGrade: BadgeVerificationGrade;
  requiredPoints?: number;
  requiredAchievementTypes?: AchievementType[];
  minVerificationLevel?: AchievementVerificationLevel;
  displayOrder: number;
}> = [
  {
    code: "CLIMATE_PASSPORT_MEMBER",
    name: "Climate Passport Member",
    nameZh: "Climate Passport 成员",
    description: "Registered and activated a Climate Passport account.",
    descriptionZh: "完成 Climate Passport 注册并激活账户。",
    category: "PARTICIPATION",
    level: "EXPLORER",
    verificationGrade: "BASIC",
    requiredAchievementTypes: ["EVENT"],
    displayOrder: 10,
  },
  {
    code: "PROFILE_COMPLETED",
    name: "Profile Completed",
    nameZh: "资料完善",
    description: "Completed baseline profile information.",
    descriptionZh: "完成基础个人资料。",
    category: "PARTICIPATION",
    level: "EXPLORER",
    verificationGrade: "BASIC",
    requiredAchievementTypes: ["VERIFIED"],
    minVerificationLevel: "SYSTEM_RECORDED",
    displayOrder: 20,
  },
  {
    code: "EVENT_PARTICIPANT",
    name: "Event Participant",
    nameZh: "活动参与者",
    description: "Completed registration and attendance check-in for events.",
    descriptionZh: "完成活动报名并签到。",
    category: "PARTICIPATION",
    level: "EXPLORER",
    verificationGrade: "VERIFIED",
    requiredAchievementTypes: ["EVENT"],
    minVerificationLevel: "SYSTEM_RECORDED",
    displayOrder: 30,
  },
  {
    code: "CLIMATE_LITERACY_LEARNER",
    name: "Climate Literacy Learner",
    nameZh: "气候素养学习者",
    description: "Completed climate literacy learning outcomes.",
    descriptionZh: "完成气候素养相关学习成果。",
    category: "LEARNING",
    level: "LEARNER",
    verificationGrade: "VERIFIED",
    requiredAchievementTypes: ["LEARNING"],
    minVerificationLevel: "SYSTEM_RECORDED",
    displayOrder: 40,
  },
  {
    code: "CLIMATE_ACTION_CONTRIBUTOR",
    name: "Climate Action Contributor",
    nameZh: "气候行动贡献者",
    description: "Contributed to climate action projects or volunteer activities.",
    descriptionZh: "参与气候行动项目或志愿贡献。",
    category: "CONTRIBUTION",
    level: "PRACTITIONER",
    verificationGrade: "VERIFIED",
    requiredAchievementTypes: ["PROJECT", "CONTRIBUTION"],
    minVerificationLevel: "PLATFORM_VERIFIED",
    displayOrder: 50,
  },
  {
    code: "YOUTH_CLIMATE_LEADER",
    name: "Youth Climate Leader",
    nameZh: "青年气候引领者",
    description: "Demonstrated leadership through verified climate initiatives.",
    descriptionZh: "在经验证的气候行动中展现领导力。",
    category: "IMPACT",
    level: "LEADER",
    verificationGrade: "EXPERT_REVIEWED",
    requiredPoints: 500,
    requiredAchievementTypes: ["VERIFIED"],
    minVerificationLevel: "INSTITUTION_VERIFIED",
    displayOrder: 60,
  },
];

const VERIFICATION_LEVEL_RANK: Record<AchievementVerificationLevel, number> = {
  SELF_RECORDED: 1,
  SYSTEM_RECORDED: 2,
  PLATFORM_VERIFIED: 3,
  INSTITUTION_VERIFIED: 4,
  EXPERT_REVIEWED: 5,
};

function compareVerificationLevel(
  current: AchievementVerificationLevel,
  required: AchievementVerificationLevel,
) {
  return VERIFICATION_LEVEL_RANK[current] >= VERIFICATION_LEVEL_RANK[required];
}

function buildBadgeVerificationToken() {
  return randomBytes(24).toString("hex");
}

export async function ensureMvpBadgeDefinitions() {
  const prisma = getPrismaClient();
  const badgeDefinitionModel = getRuntimeModel<{
    findMany: (args: unknown) => Promise<Array<{ code: string }>>;
    createMany: (args: unknown) => Promise<unknown>;
  }>(prisma, "badgeDefinition");

  if (!prisma || !badgeDefinitionModel) {
    return;
  }

  try {
    const existing = await badgeDefinitionModel.findMany({
      where: { code: { in: MVP_BADGE_DEFINITIONS.map((item) => item.code) } },
      select: { code: true },
    });

    const existingCodes = new Set(existing.map((item) => item.code));
    const missing = MVP_BADGE_DEFINITIONS.filter((item) => !existingCodes.has(item.code));

    if (missing.length === 0) {
      return;
    }

    await badgeDefinitionModel.createMany({
      data: missing.map((item) => ({
        code: item.code,
        name: item.name,
        nameZh: item.nameZh,
        description: item.description,
        descriptionZh: item.descriptionZh,
        category: item.category,
        level: item.level,
        verificationGrade: item.verificationGrade,
        requiredPoints: item.requiredPoints,
        requiredAchievementTypes: item.requiredAchievementTypes ?? [],
        requiredAchievementIds: [],
        requiredSkillTags: [],
        requiredTopicTags: [],
        minVerificationLevel: item.minVerificationLevel,
        displayOrder: item.displayOrder,
        isActive: true,
        isPublic: true,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
}

export async function createAchievementRecord(input: {
  userId: string;
  name: string;
  description?: string;
  type: AchievementType;
  sourceType?: AchievementSourceType;
  sourceId?: string;
  status?: AchievementStatus;
  verificationLevel?: AchievementVerificationLevel;
  points?: number;
  skillTags?: string[];
  topicTags?: string[];
  sdgTags?: string[];
  relatedEventId?: string;
  relatedProjectId?: string;
  relatedCertificateId?: string;
  completedAt?: Date;
  isPublic?: boolean;
  isBadgeEligible?: boolean;
  evidenceUrl?: string;
  evidenceText?: string;
  evidenceJson?: Prisma.JsonObject;
}) {
  const prisma = getPrismaClient();
  const achievementModel = getRuntimeModel<{
    findFirst: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  }>(prisma, "achievement");

  if (!prisma || !achievementModel) {
    throw new Error("Database unavailable.");
  }

  try {
    if (input.sourceType && input.sourceId) {
      const existing = await achievementModel.findFirst({
        where: {
          userId: input.userId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        return existing;
      }
    }

    const achievement = await achievementModel.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description,
        type: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: input.status ?? "APPROVED",
        verificationLevel: input.verificationLevel ?? "SYSTEM_RECORDED",
        points: input.points ?? 0,
        skillTags: input.skillTags ?? [],
        topicTags: input.topicTags ?? [],
        sdgTags: input.sdgTags ?? [],
        relatedEventId: input.relatedEventId,
        relatedProjectId: input.relatedProjectId,
        relatedCertificateId: input.relatedCertificateId,
        completedAt: input.completedAt,
        isPublic: input.isPublic ?? true,
        isBadgeEligible: input.isBadgeEligible ?? true,
        evidenceUrl: input.evidenceUrl,
        evidenceText: input.evidenceText,
        evidenceJson: input.evidenceJson,
      },
    }) as { id: string; points: number; status: AchievementStatus };

    const points = Number.isFinite(input.points) ? Math.trunc(input.points ?? 0) : 0;
    const achievementStatus = input.status ?? "APPROVED";

    if (points > 0 && achievementStatus === "APPROVED") {
      await grantUserPoints({
        client: prisma,
        userId: input.userId,
        points,
        type: "ACHIEVEMENT_REWARD",
        description: `Achievement reward: ${achievement.id}`,
        idempotencyKey: `achievement:${achievement.id}`,
      });
    }

    await evaluateBadgesForUser(input.userId);

    return achievement;
  } catch (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function evaluateBadgesForUser(userId: string) {
  const prisma = getPrismaClient();
  const userModel = getRuntimeModel<{ findUnique: (args: unknown) => Promise<{ points: number } | null> }>(prisma, "user");
  const achievementModel = getRuntimeModel<{
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      type: AchievementType;
      verificationLevel: AchievementVerificationLevel;
      points: number;
      skillTags: string[];
    }>>;
  }>(prisma, "achievement");
  const badgeDefinitionModel = getRuntimeModel<{
    findMany: (args: unknown) => Promise<Array<{
      id: string;
      code: string;
      requiredPoints: number | null;
      requiredAchievementIds: string[];
      requiredAchievementTypes: AchievementType[];
      requiredSkillTags: string[];
      minVerificationLevel: AchievementVerificationLevel | null;
    }>>;
  }>(prisma, "badgeDefinition");
  const badgeAwardModel = getRuntimeModel<{
    findMany: (args: unknown) => Promise<Array<{ badgeDefinitionId: string }>>;
    create: (args: unknown) => Promise<unknown>;
  }>(prisma, "badgeAward");

  if (!prisma || !userModel || !achievementModel || !badgeDefinitionModel || !badgeAwardModel) {
    return [] as string[];
  }

  try {
    await ensureMvpBadgeDefinitions();

    const [user, achievements, badgeDefinitions, activeAwards] = await Promise.all([
      userModel.findUnique({ where: { id: userId }, select: { points: true } }),
      achievementModel.findMany({
        where: {
          userId,
          status: "APPROVED",
          isBadgeEligible: true,
        },
        select: {
          id: true,
          type: true,
          verificationLevel: true,
          points: true,
          skillTags: true,
        },
      }),
      badgeDefinitionModel.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      }),
      badgeAwardModel.findMany({
        where: {
          userId,
          status: "ACTIVE",
        },
        select: { badgeDefinitionId: true },
      }),
    ]);

    if (!user) {
      return [] as string[];
    }

    const existingAwardSet = new Set(activeAwards.map((item) => item.badgeDefinitionId));
    const awardedCodes: string[] = [];

    for (const def of badgeDefinitions) {
      if (existingAwardSet.has(def.id)) {
        continue;
      }

      const meetsPoints = typeof def.requiredPoints === "number" ? user.points >= def.requiredPoints : true;
      if (!meetsPoints) {
        continue;
      }

      const relatedAchievements = achievements.filter((ach) => {
        if (def.requiredAchievementIds.length > 0 && !def.requiredAchievementIds.includes(ach.id)) {
          return false;
        }

        if (def.requiredAchievementTypes.length > 0 && !def.requiredAchievementTypes.includes(ach.type)) {
          return false;
        }

        if (def.minVerificationLevel && !compareVerificationLevel(ach.verificationLevel, def.minVerificationLevel)) {
          return false;
        }

        if (def.requiredSkillTags.length > 0) {
          const hit = def.requiredSkillTags.some((tag) => ach.skillTags.includes(tag));
          if (!hit) {
            return false;
          }
        }

        return true;
      });

      if (def.requiredAchievementTypes.length > 0 && relatedAchievements.length === 0) {
        continue;
      }

      const verificationToken = buildBadgeVerificationToken();

      await badgeAwardModel.create({
        data: {
          userId,
          badgeDefinitionId: def.id,
          status: "ACTIVE",
          verificationToken,
          verificationUrl: `/api/verify/badge/${verificationToken}`,
          relatedAchievementIds: relatedAchievements.map((item) => item.id),
          evidenceSnapshotJson: {
            points: user.points,
            relatedAchievementIds: relatedAchievements.map((item) => item.id),
          },
        },
      });

      awardedCodes.push(def.code);
    }

    return awardedCodes;
  } catch (error) {
    if (isMissingTableError(error)) {
      return [] as string[];
    }
    throw error;
  }
}

export async function revokeBadgeAward(input: { awardId: string; reason?: string }) {
  const prisma = getPrismaClient();
  const badgeAwardModel = getRuntimeModel<{
    update: (args: unknown) => Promise<unknown>;
  }>(prisma, "badgeAward");

  if (!prisma || !badgeAwardModel) {
    throw new Error("Database unavailable.");
  }

  return badgeAwardModel.update({
    where: { id: input.awardId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokeReason: input.reason ?? null,
    },
  });
}

export async function issueManualBadgeAward(input: {
  userId: string;
  badgeDefinitionId: string;
  awardedByUserId?: string;
  awardedByOrgName?: string;
  relatedAchievementIds?: string[];
  evidenceSnapshotJson?: Prisma.JsonObject;
}) {
  const prisma = getPrismaClient();
  const badgeAwardModel = getRuntimeModel<{
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
    create: (args: unknown) => Promise<unknown>;
  }>(prisma, "badgeAward");

  if (!prisma || !badgeAwardModel) {
    throw new Error("Database unavailable.");
  }

  const existing = await badgeAwardModel.findFirst({
    where: {
      userId: input.userId,
      badgeDefinitionId: input.badgeDefinitionId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const verificationToken = buildBadgeVerificationToken();

  return badgeAwardModel.create({
    data: {
      userId: input.userId,
      badgeDefinitionId: input.badgeDefinitionId,
      status: "ACTIVE",
      awardedByUserId: input.awardedByUserId,
      awardedByOrgName: input.awardedByOrgName,
      verificationToken,
      verificationUrl: `/api/verify/badge/${verificationToken}`,
      relatedAchievementIds: input.relatedAchievementIds ?? [],
      evidenceSnapshotJson: input.evidenceSnapshotJson,
    },
  });
}

export function getBadgeVerificationPublicPayload(input: {
  badgeName: string;
  userDisplayName: string;
  issuerName?: string | null;
  awardedAt: Date;
  verificationGrade: BadgeVerificationGrade;
  status: BadgeAwardStatus;
}) {
  return {
    valid: input.status === "ACTIVE",
    badgeName: input.badgeName,
    userDisplayName: input.userDisplayName,
    issuerName: input.issuerName ?? "Climate Passport",
    awardedAt: input.awardedAt.toISOString(),
    verificationGrade: input.verificationGrade,
    status: input.status,
  };
}
