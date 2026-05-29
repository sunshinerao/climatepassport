import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminActivityFormClient } from "@/components/admin-activity-form-client";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivityEditPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  const user = await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/edit`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const [activity, detail] = await Promise.all([
    prisma.activity.findUnique({ where: { id: params.id } }),
    (prisma as any).activityDetail?.findUnique?.({ where: { activityId: params.id } }).catch(() => null) ?? null,
  ]);
  if (!activity) notFound();

  const detailConfig = (detail?.configJson ?? {}) as Record<string, any>;

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{params.locale === "zh" ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{params.locale === "zh" ? "编辑" : "Edit"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{params.locale === "zh" ? "编辑活动" : "Edit Activity"}</h1>
        <p className="brand-subtitle">{activity.title}</p>
      </div>
      <AdminActivityFormClient
        initial={{
          ...(activity as any),
          startTime: activity.startTime ? activity.startTime.toISOString() : null,
          endTime: activity.endTime ? activity.endTime.toISOString() : null,
          registrationOpenAt: activity.registrationOpenAt ? activity.registrationOpenAt.toISOString() : null,
          registrationCloseAt: activity.registrationCloseAt ? activity.registrationCloseAt.toISOString() : null,
          invitationContentZh: detailConfig.invitationContentZh ?? "",
          invitationContentEn: detailConfig.invitationContentEn ?? "",
        }}
        locale={params.locale}
        mode="edit"
        userId={user.id}
      />
    </div>
  );
}
