import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { triggerActivityRewards, syncParticipationToPassport } from "@/lib/server/activity-rewards";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { status, pointsEarned, badgeAwardIds, certificateIssueId, passportSynced, completedAt } = body;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const existing = await prisma.activityParticipation.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Participation not found" }, { status: 404 });
  }

  const participation = await prisma.activityParticipation.update({
    where: { id: params.id },
    data: {
      ...(status !== undefined && { status }),
      ...(pointsEarned !== undefined && { pointsEarned }),
      ...(badgeAwardIds !== undefined && { badgeAwardIds }),
      ...(certificateIssueId !== undefined && { certificateIssueId }),
      ...(passportSynced !== undefined && { passportSynced }),
      ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
    },
  });

  // Trigger completion rewards and passport sync
  if (status === "COMPLETED" || status === "CERTIFIED") {
    void triggerActivityRewards({ activityId: participation.activityId, userId: participation.userId, trigger: "PARTICIPATION_COMPLETED" });
    void syncParticipationToPassport(participation.id);
  }

  return NextResponse.json({ participation });
}
