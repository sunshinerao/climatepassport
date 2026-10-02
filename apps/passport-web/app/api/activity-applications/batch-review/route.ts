import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { allowedProjectReviewStatuses, canReviewProjectApplication } from "@/lib/server/project-application";

export async function PATCH(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const ids = body.ids as string[] | undefined;
  const rawStatus = body.status as string | undefined;
  const reviewComment = body.reviewComment as string | undefined;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  const applications = await prisma.activityApplication.findMany({
    where: { id: { in: ids } },
    include: { activity: true },
  });

  if (applications.length === 0) {
    return NextResponse.json({ error: "No applications found" }, { status: 404 });
  }

  const anyProject = applications.some((a) => a.activity.type === "PROJECT");

  if (anyProject) {
    if (!rawStatus || !allowedProjectReviewStatuses().includes(rawStatus)) {
      return NextResponse.json(
        { error: `Project status must be one of: ${allowedProjectReviewStatuses().join(", ")}` },
        { status: 400 }
      );
    }
  } else {
    const validStatuses = ["APPROVED", "REJECTED", "WAITLISTED", "PENDING_REVIEW"] as const;
    type ValidStatus = (typeof validStatuses)[number];
    if (!rawStatus || !validStatuses.includes(rawStatus as ValidStatus)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }
  }

  const status = rawStatus as "APPROVED" | "REJECTED" | "WAITLISTED";

  // Verify authorization for each application.
  for (const app of applications) {
    const isProject = app.activity.type === "PROJECT";
    if (isProject) {
      const authorized = await canReviewProjectApplication(currentUser, app.activity);
      if (!authorized) {
        return NextResponse.json({ error: "Forbidden: not authorized to review one or more project applications" }, { status: 403 });
      }
    } else {
      if (currentUser.role !== "ADMIN") {
        const managed = await prisma.activity.findFirst({
          where: { id: app.activityId, organizerUserId: currentUser.id },
          select: { id: true },
        });
        if (!managed) {
          return NextResponse.json({ error: "Forbidden: not all activities are managed by you" }, { status: 403 });
        }
      }
    }
  }

  // Update all applications — scoped to the ids actually fetched and authorized above,
  // never the raw request array, so an unknown/mismatched id can never be written.
  const authorizedIds = applications.map((application) => application.id);
  const updated = await prisma.activityApplication.updateMany({
    where: { id: { in: authorizedIds } },
    data: {
      status,
      reviewComment: reviewComment || null,
      reviewedByUserId: currentUser.id,
      reviewedAt: new Date(),
    },
  });

  // Auto-create participation records for APPROVED
  if (status === "APPROVED") {
    for (const app of applications) {
      const participationExists = await prisma.activityParticipation.findUnique({
        where: { activityId_userId: { activityId: app.activityId, userId: app.userId } },
      });
      if (!participationExists) {
        await prisma.activityParticipation.create({
          data: {
            activityId: app.activityId,
            userId: app.userId,
            roleType: app.roleType ?? undefined,
            status: "ACCEPTED",
          },
        });
      }
      await triggerActivityRewards({
        activityId: app.activityId,
        userId: app.userId,
        trigger: "REGISTRATION_APPROVED",
      });

      await prisma.notification.create({
        data: {
          userId: app.userId,
          channel: "IN_APP",
          kind: "SYSTEM",
          title: "项目申请已通过",
          titleEn: "Project application approved",
          body: `你的项目申请「${app.activity.title}」已通过。`,
          bodyEn: `Your project application "${app.activity.titleEn ?? app.activity.title}" has been approved.`,
          actionUrl: `/en/activities/${app.activityId}`,
          metadata: { activityId: app.activityId, applicationId: app.id, source: "PROJECT_APPLICATION_BATCH_REVIEW" },
        },
      }).catch(() => undefined);
    }
  }

  await writeCoreAuditLog({
    actorUserId: currentUser.id,
    action: "PROJECT_APPLICATION_BATCH_REVIEWED",
    subjectType: "ActivityApplication",
    subjectId: null,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { applicationIds: authorizedIds, toStatus: status, count: updated.count },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, count: updated.count });
}
