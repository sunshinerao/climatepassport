import type { PrismaClient } from "@prisma/client";
import { resolveScopedAccess } from "./programme-scope";

type GovernanceProjectReader = Pick<
  PrismaClient,
  | "accessMembership"
  | "governanceProject"
  | "programme"
  | "edition"
  | "objectAuthorization"
  | "institutionRepresentation"
  | "sourceObjectMapping"
>;

export type GovernanceProjectSummary = {
  id: string;
  code: string;
  programmeId: string;
  programmeName: string;
  institutionId: string;
  institutionName: string;
  activityId: string | null;
  kind: string;
  title: string;
  status: string;
  createdAt: Date;
  accessRole: string | null;
  canManage: boolean;
};

function activeMembershipWindow(now: Date) {
  return {
    isActive: true,
    revokedAt: null,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    ],
  };
}

/** Lists only whole-Programme governance projects the actor can actually read. */
export async function listGovernanceProjects(
  prisma: GovernanceProjectReader,
  actorUserId: string,
): Promise<{ projects: GovernanceProjectSummary[] }> {
  const now = new Date();
  const memberships = await prisma.accessMembership.findMany({
    where: {
      userId: actorUserId,
      editionId: null,
      ...activeMembershipWindow(now),
    },
    select: { programmeId: true },
  });
  const programmeIds = [...new Set(memberships.map((membership) => membership.programmeId))];
  if (programmeIds.length === 0) return { projects: [] };

  const candidates = await prisma.governanceProject.findMany({
    where: { programmeId: { in: programmeIds } },
    select: {
      id: true,
      code: true,
      programmeId: true,
      institutionId: true,
      activityId: true,
      kind: true,
      title: true,
      status: true,
      createdAt: true,
      programme: { select: { name: true } },
      institution: { select: { name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });

  const accessByProgramme = new Map<string, { role: string | null; canManage: boolean }>();
  for (const programmeId of programmeIds) {
    const [readAccess, manageAccess] = await Promise.all([
      resolveScopedAccess(prisma, { id: actorUserId }, { programmeId }, "read"),
      resolveScopedAccess(prisma, { id: actorUserId }, { programmeId }, "manage"),
    ]);
    if (readAccess.allowed) {
      accessByProgramme.set(programmeId, {
        role: readAccess.role,
        canManage: manageAccess.allowed,
      });
    }
  }

  return {
    projects: candidates.flatMap((project) => {
      const access = accessByProgramme.get(project.programmeId);
      if (!access) return [];
      return [{
        id: project.id,
        code: project.code,
        programmeId: project.programmeId,
        programmeName: project.programme.name,
        institutionId: project.institutionId,
        institutionName: project.institution.name,
        activityId: project.activityId,
        kind: project.kind,
        title: project.title,
        status: project.status,
        createdAt: project.createdAt,
        accessRole: access.role,
        canManage: access.canManage,
      }];
    }),
  };
}