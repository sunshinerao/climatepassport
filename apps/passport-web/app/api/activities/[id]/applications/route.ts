import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { requireApiRole } from "@/lib/server/api-auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { buildProjectApplicantDisclosure, canReviewProjectApplication } from "@/lib/server/project-application";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { canManageActivity } from "@/lib/server/verifier-activity";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const activity = await prisma.activity.findUnique({ where: { id: params.id }, select: { id: true, type: true, organizerUserId: true, capacity: true } });
  if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  if (activity.type === "PROJECT") {
    if (!(await canReviewProjectApplication(currentUser, activity))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
    if (auth instanceof NextResponse) return auth;
    if (!(await canManageActivity(prisma, auth, activity.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const where: Record<string, unknown> = { activityId: params.id };

  if (status) {
    where.status = status;
  }

  if (search) {
    const searchLower = search.toLowerCase();
    where.OR = [
      {
        user: {
          name: { contains: searchLower, mode: "insensitive" },
        },
      },
      {
        user: {
          email: { contains: searchLower, mode: "insensitive" },
        },
      },
    ];
  }

  const [applications, stats] = await Promise.all([
    prisma.activityApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true, title: true, bio: true, avatar: true, climatePassportId: true } }, projectConsent: true },
    }),
    prisma.activityApplication.groupBy({
      by: ["status"],
      where: { activityId: params.id },
      _count: { status: true },
    }),
  ]);

  const applicationsWithUser = await Promise.all(applications.map(async (app) => {
    if (activity.type !== "PROJECT") return app;
    const disclosure = await buildProjectApplicantDisclosure(app.user, app.projectConsent);
    return {
      ...app,
      userId: undefined,
      user: { avatar: app.user.avatar, ...disclosure },
      projectConsent: app.projectConsent ? {
        policyVersion: app.projectConsent.policyVersion,
        shareName: app.projectConsent.shareName, shareEmail: app.projectConsent.shareEmail,
        shareTitle: app.projectConsent.shareTitle, shareBio: app.projectConsent.shareBio,
        shareAffiliations: app.projectConsent.shareAffiliations, sharePortfolioLink: app.projectConsent.sharePortfolioLink,
      } : null,
    };
  }));

  const approvedCount =
    stats.find((s) => s.status === "APPROVED")?._count.status ?? 0;

  if (activity.type === "PROJECT") await writeCoreAuditLog({ actorUserId: currentUser.id, action: "PROJECT_APPLICATIONS_VIEWED", subjectType: "Activity", subjectId: activity.id, result: "SUCCESS", ...getRequestAuditContext(req), metadataJson: { activityId: activity.id, count: applications.length } }).catch(() => undefined);

  return NextResponse.json({
    applications: applicationsWithUser,
    stats: {
      approvedCount,
      capacity: activity.capacity ?? null,
      byStatus: stats.reduce(
        (acc, s) => {
          acc[s.status] = s._count.status;
          return acc;
        },
        {} as Record<string, number>
      ),
    },
  });
}
