import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import {
  allowedProjectReviewStatuses,
  canReviewProjectApplication,
  isValidProjectConsentInput,
  PROJECT_APPLICATION_CONSENT_POLICY_VERSION,
  validateProjectPortfolioShareLink,
} from "@/lib/server/project-application";
import { canManageActivity } from "@/lib/server/verifier-activity";

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !["ADMIN", "EVENT_MANAGER"].includes(currentUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const activityId = searchParams.get("activityId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const where: any = {
    ...(activityId ? { activityId } : {}),
    ...(status ? { status: status as any } : {}),
    ...(userId ? { userId } : {}),
    ...(currentUser.role === "EVENT_MANAGER"
      ? { activity: { organizerUserId: currentUser.id } }
      : {}),
  };

  const [total, applications] = await Promise.all([
    prisma.activityApplication.count({ where }),
    prisma.activityApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        activity: { select: { id: true, title: true, type: true, status: true } },
      },
    }),
  ]);

  return NextResponse.json({ applications, total, page, limit });
}

export async function POST(req: NextRequest) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { activityId, userId, roleType, formResponseJson, status, consent } = body;

  if (!activityId || !userId) {
    return NextResponse.json({ error: "Missing required fields: activityId, userId" }, { status: 400 });
  }

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const isProjectApplicantSubmit =
    activity.type === "PROJECT" && status === "SUBMITTED";

  if (isProjectApplicantSubmit) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (currentUser.id !== userId) {
      return NextResponse.json({ error: "Forbidden: can only submit your own application" }, { status: 403 });
    }

    if (!isValidProjectConsentInput(consent)) {
      return NextResponse.json(
        { error: `Explicit consent required with policy version ${PROJECT_APPLICATION_CONSENT_POLICY_VERSION}` },
        { status: 400 }
      );
    }

    // At least one disclosure field must be explicitly chosen.
    const anyDisclosure =
      consent.shareName ||
      consent.shareEmail ||
      consent.shareTitle ||
      consent.shareBio ||
      consent.shareAffiliations ||
      consent.sharePortfolioLink;
    if (!anyDisclosure) {
      return NextResponse.json({ error: "At least one disclosure field must be consented" }, { status: 400 });
    }

    if (consent.sharePortfolioLink && !consent.portfolioShareLinkId) {
      return NextResponse.json({ error: "Portfolio share link reference required when sharing portfolio" }, { status: 400 });
    }

    try {
      await validateProjectPortfolioShareLink(userId, consent.portfolioShareLinkId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? "Invalid portfolio share link" }, { status: 400 });
    }

    const existing = await prisma.activityApplication.findUnique({
      where: { activityId_userId: { activityId, userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Application already exists for this user and activity" }, { status: 409 });
    }

    const application = await prisma.activityApplication.create({
      data: {
        activityId,
        userId,
        roleType,
        formResponseJson,
        status: "SUBMITTED",
        submittedAt: new Date(),
        projectConsent: {
          create: {
            policyVersion: consent.policyVersion,
            shareName: consent.shareName,
            shareEmail: consent.shareEmail,
            shareTitle: consent.shareTitle,
            shareBio: consent.shareBio,
            shareAffiliations: consent.shareAffiliations,
            sharePortfolioLink: consent.sharePortfolioLink,
            portfolioShareLinkId: consent.portfolioShareLinkId ?? null,
            purposeSnapshot: consent.purposeSnapshot ?? null,
          },
        },
      },
      include: { projectConsent: true },
    });

    await writeCoreAuditLog({
      actorUserId: currentUser.id,
      action: "PROJECT_APPLICATION_SUBMITTED",
      subjectType: "ActivityApplication",
      subjectId: application.id,
      result: "SUCCESS",
      ...getRequestAuditContext(req),
      metadataJson: { activityId, hasConsent: true, policyVersion: consent.policyVersion },
    }).catch(() => undefined);
    await writeCoreAuditLog({
      actorUserId: currentUser.id,
      action: "PROJECT_APPLICATION_CONSENT_RECORDED",
      subjectType: "ProjectApplicationConsent",
      subjectId: application.projectConsent?.id ?? null,
      result: "SUCCESS",
      ...getRequestAuditContext(req),
      metadataJson: { activityId, policyVersion: consent.policyVersion, sharedFields: Object.entries(consent).filter(([key, value]) => key.startsWith("share") && value).map(([key]) => key) },
    }).catch(() => undefined);

    await prisma.notification.create({
      data: {
        userId: currentUser.id,
        channel: "IN_APP",
        kind: "SYSTEM",
        title: "项目申请已提交",
        titleEn: "Project application submitted",
        body: `你的项目申请「${activity.title}」已提交，等待审核。`,
        bodyEn: `Your project application "${activity.titleEn ?? activity.title}" has been submitted and is pending review.`,
        actionUrl: `/en/activities/${activityId}`,
        metadata: { activityId, applicationId: application.id, source: "PROJECT_APPLICATION_SUBMIT" },
      },
    }).catch(() => undefined);

    if (activity.organizerUserId) {
      await prisma.notification.create({
        data: {
          userId: activity.organizerUserId,
          channel: "IN_APP",
          kind: "SYSTEM",
          title: "新项目申请",
          titleEn: "New project application",
          body: `「${activity.title}」收到一份新申请。`,
          bodyEn: `A new application was received for "${activity.titleEn ?? activity.title}".`,
          actionUrl: `/en/admin/activities/${activityId}/applications`,
          metadata: { activityId, applicationId: application.id, source: "PROJECT_APPLICATION_SUBMIT" },
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({ application }, { status: 201 });
  }

  // Established non-project behavior: admin/event_manager only.
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  if (!(await canManageActivity(prisma, auth, activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.activityApplication.findUnique({
    where: { activityId_userId: { activityId, userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Application already exists for this user and activity" }, { status: 409 });
  }

  const application = await prisma.activityApplication.create({
    data: {
      activityId,
      userId,
      roleType,
      formResponseJson,
      status: status ?? "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ application }, { status: 201 });
}
