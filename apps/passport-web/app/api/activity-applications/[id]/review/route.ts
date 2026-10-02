import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { requireApiRole } from "@/lib/server/api-auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import {
  allowedProjectReviewStatuses,
  canReviewProjectApplication,
} from "@/lib/server/project-application";
import { canManageActivity } from "@/lib/server/verifier-activity";
import {
  admitApplicationToOccurrence,
  releaseSeatAndPromoteWaitlist,
  type OccurrenceError,
} from "@/lib/server/activity-occurrences";

class OccurrenceFailure extends Error {
  constructor(public detail: OccurrenceError) {
    super(detail.error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const { status, reviewComment } = body;
  const occurrenceId = typeof body.occurrenceId === "string" && body.occurrenceId ? body.occurrenceId : undefined;

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
  if (occurrenceId && isProject) {
    return NextResponse.json({ error: "Project applications are not occurrence-based" }, { status: 400 });
  }

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
    const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
    if (auth instanceof NextResponse) return auth;
    if (!(await canManageActivity(prisma, auth, existing.activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // CP-TODO-246：携带 occurrenceId 的审核走原子占位/候补提升路径；未携带时保持既有行为完全不变。
  if (occurrenceId) {
    const occurrence = await prisma.activityOccurrence.findUnique({ where: { id: occurrenceId } });
    if (!occurrence || occurrence.activityId !== existing.activityId) {
      return NextResponse.json({ error: "Occurrence not found", code: "OCCURRENCE_NOT_FOUND" }, { status: 404 });
    }

    const auditContext = getRequestAuditContext(req);
    const outcome: {
      admitted: { participationCreated: boolean } | null;
      promoted: { applicationId: string; userId: string; participationCreated: boolean } | null;
    } = { admitted: null, promoted: null };

    try {
      await prisma.$transaction(async (tx) => {
        // 离开 APPROVED（拒绝/改候补等）：先释放名额并按申请时间提升最早候补。
        if (existing.status === "APPROVED" && existing.occurrenceId && status !== "APPROVED") {
          const released = await releaseSeatAndPromoteWaitlist(tx, {
            activityId: existing.activityId,
            occurrenceId: existing.occurrenceId,
          });
          if ("error" in released) throw new OccurrenceFailure(released);
          if (released.promoted) outcome.promoted = released.promoted;
        }

        if (status === "APPROVED") {
          const result = await admitApplicationToOccurrence(tx, {
            applicationId: existing.id,
            activityId: existing.activityId,
            userId: existing.userId,
            roleType: existing.roleType,
            occurrenceId,
            reviewedByUserId: currentUser.id,
            reviewComment,
          });
          if ("error" in result) throw new OccurrenceFailure(result);
          outcome.admitted = result;
        } else {
          const leavingApproved = existing.status === "APPROVED" && Boolean(existing.occurrenceId);
          const updated = await tx.activityApplication.updateMany({
            where: {
              id: existing.id,
              status: {
                in: leavingApproved
                  ? ["SUBMITTED", "PENDING_REVIEW", "INTERVIEW", "OFFERED", "WAITLISTED", "APPROVED"]
                  : ["SUBMITTED", "PENDING_REVIEW", "INTERVIEW", "OFFERED", "WAITLISTED"],
              },
            },
            data: {
              status,
              occurrenceId,
              reviewComment,
              reviewedByUserId: currentUser.id,
              reviewedAt: new Date(),
            },
          });
          if (updated.count !== 1) {
            throw new OccurrenceFailure({ error: "Application is no longer in a reviewable status", status: 409, code: "INVALID_REQUEST" });
          }
        }

        await tx.coreAuditLog.create({
          data: {
            actorUserId: currentUser.id,
            action: "ACTIVITY_APPLICATION_REVIEWED",
            subjectType: "ActivityApplication",
            subjectId: existing.id,
            result: "SUCCESS",
            ...auditContext,
            metadataJson: {
              activityId: existing.activityId,
              toStatus: status,
              occurrenceId,
              promoted: outcome.promoted ? { applicationId: outcome.promoted.applicationId } : null,
            },
          },
        });
      });
    } catch (error) {
      if (error instanceof OccurrenceFailure) {
        return NextResponse.json({ error: error.detail.error, code: error.detail.code }, { status: error.detail.status });
      }
      throw error;
    }

    if (outcome.admitted?.participationCreated) {
      await triggerActivityRewards({ activityId: existing.activityId, userId: existing.userId, trigger: "REGISTRATION_APPROVED" });
    }
    if (outcome.promoted) {
      if (outcome.promoted.participationCreated) {
        await triggerActivityRewards({ activityId: existing.activityId, userId: outcome.promoted.userId, trigger: "REGISTRATION_APPROVED" });
      }
      await prisma.notification.create({
        data: {
          userId: outcome.promoted.userId,
          channel: "IN_APP",
          kind: "SYSTEM",
          title: "你已从候补名单转正",
          titleEn: "You have been admitted from the waitlist",
          body: `你在「${existing.activity.title}」的候补申请已确认占位。`,
          bodyEn: `Your waitlisted application for "${existing.activity.titleEn ?? existing.activity.title}" has been admitted.`,
          actionUrl: `/en/activities/${existing.activityId}`,
          metadata: { activityId: existing.activityId, source: "ACTIVITY_WAITLIST_PROMOTION" },
        },
      }).catch(() => undefined);
    }

    const application = await prisma.activityApplication.findUnique({ where: { id: existing.id } });
    return NextResponse.json({ application });
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
    await triggerActivityRewards({ activityId: existing.activityId, userId: existing.userId, trigger: "REGISTRATION_APPROVED" });
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
