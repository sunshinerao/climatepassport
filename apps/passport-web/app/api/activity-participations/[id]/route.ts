import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { triggerActivityRewards, syncParticipationToPassport } from "@/lib/server/activity-rewards";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { canTransitionActivityParticipation, isActivityParticipationStatus } from "@/lib/server/activity-participation";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { requireApiRole } from "@/lib/server/api-auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Object.keys(body).some((key) => key !== "status")) {
    return NextResponse.json({ error: "Only the participation status can be changed here." }, { status: 400 });
  }
  const { status } = body as { status?: unknown };
  if (!isActivityParticipationStatus(status)) {
    return NextResponse.json({ error: "Invalid participation status." }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const existing = await prisma.activityParticipation.findUnique({
    where: { id: params.id },
    select: { id: true, activityId: true, userId: true, status: true, completedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Participation not found" }, { status: 404 });
  }
  if (!(await canManageActivity(prisma, auth, existing.activityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isActivityParticipationStatus(existing.status) || !canTransitionActivityParticipation(existing.status, status)) {
    return NextResponse.json({ error: `Cannot transition participation from ${existing.status} to ${status}.` }, { status: 409 });
  }

  const participation = await prisma.activityParticipation.update({
    where: { id: params.id },
    data: {
      status,
      ...(["COMPLETED", "CERTIFIED"].includes(status) && !existing.completedAt ? { completedAt: new Date() } : {}),
    },
  });

  const enteredCompletedState = ["COMPLETED", "CERTIFIED"].includes(status)
    && !["COMPLETED", "CERTIFIED"].includes(existing.status);
  if (enteredCompletedState) {
    await triggerActivityRewards({ activityId: participation.activityId, userId: participation.userId, trigger: "PARTICIPATION_COMPLETED" });
    await syncParticipationToPassport(participation.id);
  }

  await writeCoreAuditLog({
    actorUserId: auth.id,
    action: "ACTIVITY_PARTICIPATION_STATUS_UPDATED",
    subjectType: "ActivityParticipation",
    subjectId: participation.id,
    result: "SUCCESS",
    metadataJson: { activityId: participation.activityId, fromStatus: existing.status, toStatus: status },
    ...getRequestAuditContext(req),
  });

  return NextResponse.json({ participation });
}
