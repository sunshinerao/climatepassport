import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminActivityApplicationsClient } from "@/components/admin-activity-applications-client";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivityApplicationsPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  const user = await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/applications`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const [activity, applications] = await Promise.all([
    prisma.activity.findUnique({ where: { id: params.id }, select: { id: true, title: true } }),
    prisma.activityApplication.findMany({
      where: { activityId: params.id },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, climatePassportId: true },
        },
      },
    }),
  ]);

  if (!activity) notFound();

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
        applications={applications.map((a) => ({
          ...a,
          submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
          reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
          formResponseJson: a.formResponseJson,
        }))}
        locale={params.locale}
        reviewerUserId={user.id}
      />
    </div>
  );
}
