import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { getCurrentUser, requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminActivityApplicationsClient } from "@/components/admin-activity-applications-client";
import type { Locale } from "@/lib/site-content";
import { canReviewProjectApplication } from "@/lib/server/project-application";
import { buildProjectApplicantDisclosure } from "@/lib/server/project-application";

export default async function AdminActivityApplicationsPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  const currentUser = await getCurrentUser();
  if (!currentUser) return requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/activities/${params.id}/applications`) as never;

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const [activity, applications] = await Promise.all([
    prisma.activity.findUnique({ where: { id: params.id }, select: { id: true, title: true, type: true, organizerUserId: true } }),
    prisma.activityApplication.findMany({
      where: { activityId: params.id },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, title: true, bio: true, avatar: true, climatePassportId: true },
        },
        projectConsent: true,
      },
    }),
  ]);

  if (!activity) notFound();
  if (activity.type === "PROJECT") {
    if (!(await canReviewProjectApplication(currentUser, activity))) notFound();
  } else if (!(["ADMIN", "EVENT_MANAGER"] as string[]).includes(currentUser.role)) {
    return requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/applications`) as never;
  }

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{params.locale === "zh" ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{params.locale === "zh" ? "报名审核" : "Applications"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{params.locale === "zh" ? "报名审核" : "Application Review"}</h1>
        <p className="brand-subtitle">{activity.title}</p>
      </div>
      <AdminActivityApplicationsClient
        activityId={params.id}
        applications={(await Promise.all(applications.map(async (a) => ({
          ...a,
          ...(activity.type === "PROJECT" ? { userId: undefined, user: { avatar: a.user.avatar, ...(await buildProjectApplicantDisclosure(a.user, a.projectConsent)) }, projectConsent: a.projectConsent ? { policyVersion: a.projectConsent.policyVersion, shareName: a.projectConsent.shareName, shareEmail: a.projectConsent.shareEmail, shareTitle: a.projectConsent.shareTitle, shareBio: a.projectConsent.shareBio, shareAffiliations: a.projectConsent.shareAffiliations, sharePortfolioLink: a.projectConsent.sharePortfolioLink } : null } : {}),
          submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
          reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
          formResponseJson: a.formResponseJson,
        })))) as any}
        locale={params.locale}
        reviewerUserId={currentUser.id}
      />
    </div>
  );
}
