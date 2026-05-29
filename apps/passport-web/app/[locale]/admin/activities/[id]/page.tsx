import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminActivityDetailClient } from "@/components/admin-activity-detail-client";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivityDetailPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: {
          applications: true,
          participations: true,
          checkinRecords: true,
          submissions: true,
        },
      },
    },
  });

  if (!activity) notFound();

  const zh = params.locale === "zh";

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{zh ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <span>{zh ? "活动详情" : "Activity Detail"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{zh ? "活动详情" : "Activity Detail"}</h1>
        <p className="brand-subtitle">{activity.title}</p>
      </div>
      <AdminActivityDetailClient
        activity={{
          ...activity,
          startTime: activity.startTime ? activity.startTime.toISOString() : null,
          endTime: activity.endTime ? activity.endTime.toISOString() : null,
          createdAt: activity.createdAt.toISOString(),
        }}
        locale={params.locale}
      />
    </div>
  );
}
