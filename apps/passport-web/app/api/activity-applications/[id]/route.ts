import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { requireApiRole } from "@/lib/server/api-auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { buildProjectApplicantDisclosure, canReviewProjectApplication } from "@/lib/server/project-application";
import { canManageActivity } from "@/lib/server/verifier-activity";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const application = await prisma.activityApplication.findUnique({
    where: { id: params.id },
    include: {
      activity: { select: { id: true, title: true, slug: true, type: true, organizerUserId: true } },
      projectConsent: {
        select: {
          policyVersion: true,
          shareName: true,
          shareEmail: true,
          shareTitle: true,
          shareBio: true,
          shareAffiliations: true,
          sharePortfolioLink: true,
          portfolioShareLinkId: true,
          purposeSnapshot: true,
        },
      },
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isApplicant = application.userId === currentUser.id;
  const isProject = application.activity.type === "PROJECT";
  const canAdminReview = !isProject && (await canManageActivity(prisma, currentUser, application.activityId));
  const canProjectReview = isProject && (await canReviewProjectApplication(currentUser, application.activity));

  if (!isApplicant && !canAdminReview && !canProjectReview) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const safeApplication = application;
  if (isProject && canProjectReview) {
    const applicant = await prisma.user.findUnique({ where: { id: application.userId }, select: { id: true, name: true, email: true, title: true, bio: true } });
    const disclosure = applicant ? await buildProjectApplicantDisclosure(applicant, application.projectConsent) : {};
    Object.assign(safeApplication, { userId: undefined, applicant: disclosure });
    await writeCoreAuditLog({ actorUserId: currentUser.id, action: "PROJECT_APPLICATION_VIEWED", subjectType: "ActivityApplication", subjectId: application.id, result: "SUCCESS", ...getRequestAuditContext(req), metadataJson: { activityId: application.activityId } }).catch(() => undefined);
  }

  return NextResponse.json({ application: safeApplication });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.activityApplication.findUnique({
    where: { id: params.id },
    include: { activity: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { action, formResponseJson, reviewComment } = body;

  // "withdraw" action can be performed by the applicant themselves
  if (action === "withdraw") {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // PROJECT applications can only be withdrawn by their applicant.
    if (existing.userId !== currentUser.id) {
      const isProject = existing.activity.type === "PROJECT";
      if (isProject) {
        return NextResponse.json({ error: "Only the applicant can withdraw a project application" }, { status: 403 });
      } else {
        const adminCheck = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
        if (adminCheck instanceof NextResponse) {
          return NextResponse.json({ error: "Not authorized to withdraw this application" }, { status: 403 });
        }
        if (!(await canManageActivity(prisma, adminCheck, existing.activityId))) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    if (!["SUBMITTED", "PENDING_REVIEW", "WAITLISTED"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Can only withdraw applications in SUBMITTED, PENDING_REVIEW, or WAITLISTED status" },
        { status: 409 }
      );
    }

    const application = await prisma.activityApplication.update({
      where: { id: params.id },
      data: { status: "WITHDRAWN" },
    });

    if (existing.activity.type === "PROJECT") await writeCoreAuditLog({
      actorUserId: currentUser.id,
      action: "PROJECT_APPLICATION_WITHDRAWN",
      subjectType: "ActivityApplication",
      subjectId: application.id,
      result: "SUCCESS",
      ...getRequestAuditContext(req),
      metadataJson: { activityId: existing.activityId, fromStatus: existing.status },
    }).catch(() => undefined);

    await prisma.notification.create({
      data: {
        userId: existing.userId,
        channel: "IN_APP",
        kind: "SYSTEM",
        title: "项目申请已撤回",
        titleEn: "Project application withdrawn",
        body: `你的项目申请「${existing.activity.title}」已撤回。`,
        bodyEn: `Your project application "${existing.activity.titleEn ?? existing.activity.title}" has been withdrawn.`,
        actionUrl: `/en/activities/${existing.activityId}`,
        metadata: { activityId: existing.activityId, applicationId: application.id, source: "PROJECT_APPLICATION_WITHDRAW" },
      },
    }).catch(() => undefined);

    if (existing.activity.organizerUserId) {
      await prisma.notification.create({
        data: {
          userId: existing.activity.organizerUserId,
          channel: "IN_APP",
          kind: "SYSTEM",
          title: "项目申请已撤回",
          titleEn: "Project application withdrawn",
          body: `「${existing.activity.title}」的一份申请已撤回。`,
          bodyEn: `An application for "${existing.activity.titleEn ?? existing.activity.title}" has been withdrawn.`,
          actionUrl: `/en/admin/activities/${existing.activityId}/applications`,
          metadata: { activityId: existing.activityId, applicationId: application.id, source: "PROJECT_APPLICATION_WITHDRAW" },
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({ application });
  }

  // Other PATCH operations require admin/event_manager or project owner
  const isProject = existing.activity.type === "PROJECT";
  if (isProject) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const authorized = await canReviewProjectApplication(currentUser, existing.activity);
    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
    if (auth instanceof NextResponse) return auth;
    if (!(await canManageActivity(prisma, auth, existing.activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const application = await prisma.activityApplication.update({
    where: { id: params.id },
    data: {
      ...(formResponseJson !== undefined ? { formResponseJson } : {}),
      ...(reviewComment !== undefined ? { reviewComment } : {}),
    },
  });

  return NextResponse.json({ application });
}
