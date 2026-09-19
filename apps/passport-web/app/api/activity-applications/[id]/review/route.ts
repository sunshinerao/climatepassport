import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import {
  allowedProjectReviewStatuses,
  canReviewProjectApplication,
} from "@/lib/server/project-application";
import { canManageActivity } from "@/lib/server/verifier-activity";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const { status, reviewComment } = body;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.activityApplication.findUnique({
    where: { id: params.id },
    include: { activity: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const isProject = existing.activity.type === "PROJECT";

  if (isProject) {
    const authorized = await canReviewProjectApplication(currentUser, existing.activity);
    if (!authorized) {
      return NextResponse.json({ error: "Forbidden: not authorized to review this project application" }, { status: 403 });
    }
    if (!status || !allowedProjectReviewStatuses().includes(status)) {
      return NextResponse.json(
        { error: `Project status must be one of: ${allowedProjectReviewStatuses().join(", ")}` },
        { status: 400 }
      );
    }
  } else {
    // INTERVIEW and OFFERED are Learning Experience-specific transitions
    const validStatuses = ["APPROVED", "REJECTED", "WAITLISTED", "PENDING_REVIEW", "INTERVIEW", "OFFERED"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }
    const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
    if (auth instanceof NextResponse) return auth;
    if (!(await canManageActivity(prisma, auth, existing.activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const application = await prisma.activityApplication.update({
    where: { id: params.id },
    data: {
      status,
      reviewComment,
      reviewedByUserId: currentUser.id,
      reviewedAt: new Date(),
    },
  });

  // Auto-create participation record when approved, exactly once
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

  if (isProject) await writeCoreAuditLog({
    actorUserId: currentUser.id,
    action: "PROJECT_APPLICATION_REVIEWED",
    subjectType: "ActivityApplication",
    subjectId: application.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { activityId: existing.activityId, toStatus: status, isProject },
  }).catch(() => undefined);

  if (!isProject) return NextResponse.json({ application });
  const activityTitle = existing.activity.title;
  const activityTitleEn = existing.activity.titleEn ?? activityTitle;
  await prisma.notification.create({
    data: {
      userId: existing.userId,
      channel: "IN_APP",
      kind: "SYSTEM",
      title: status === "APPROVED" ? "项目申请已通过" : status === "REJECTED" ? "项目申请未通过" : "项目申请已候补",
      titleEn: status === "APPROVED" ? "Project application approved" : status === "REJECTED" ? "Project application rejected" : "Project application waitlisted",
      body: `你的项目申请「${activityTitle}」状态已更新为 ${status}。`,
      bodyEn: `Your project application "${activityTitleEn}" status has been updated to ${status}.`,
      actionUrl: `/en/activities/${existing.activityId}`,
      metadata: { activityId: existing.activityId, applicationId: application.id, status, source: "PROJECT_APPLICATION_REVIEW" },
    },
  }).catch(() => undefined);

  return NextResponse.json({ application });
}
