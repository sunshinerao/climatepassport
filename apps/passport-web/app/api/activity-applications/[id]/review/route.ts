import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { status, reviewComment, reviewedByUserId } = body;

  // INTERVIEW and OFFERED are Learning Experience-specific transitions
  const validStatuses = ["APPROVED", "REJECTED", "WAITLISTED", "PENDING_REVIEW", "INTERVIEW", "OFFERED"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const existing = await prisma.activityApplication.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const application = await prisma.activityApplication.update({
    where: { id: params.id },
    data: {
      status,
      reviewComment,
      reviewedByUserId,
      reviewedAt: new Date(),
    },
  });

  // Auto-create participation record when approved
  if (status === "APPROVED") {
    const participationExists = await prisma.activityParticipation.findUnique({
      where: { activityId_userId: { activityId: existing.activityId, userId: existing.userId } },
    });
    if (!participationExists) {
      await prisma.activityParticipation.create({
        data: {
          activityId: existing.activityId,
          userId: existing.userId,
          roleType: existing.roleType ?? undefined,
          status: "ACCEPTED",
        },
      });
    }
    // Fire reward trigger asynchronously (do not await to keep response fast)
    void triggerActivityRewards({ activityId: existing.activityId, userId: existing.userId, trigger: "REGISTRATION_APPROVED" });
  }

  return NextResponse.json({ application });
}
