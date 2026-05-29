import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminActivityAgendaClient } from "@/components/admin-activity-agenda-client";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivityAgendaPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/agenda`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const [activity, agendaItems, speakers] = await Promise.all([
    prisma.activity.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, type: true, organizerUserId: true },
    }),
    prisma.activityAgendaItem.findMany({
      where: { activityId: params.id },
      include: {
        moderator: {
          select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
        },
        speakers: {
          orderBy: { order: "asc" },
          include: {
            speaker: {
              select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
            },
          },
        },
      },
      orderBy: [{ agendaDate: "asc" }, { startTime: "asc" }, { order: "asc" }],
    }),
    prisma.speaker.findMany({
      where: { isVisible: true },
      select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
      orderBy: { name: "asc" },
      take: 200,
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
        <span>{params.locale === "zh" ? "议程管理" : "Agenda"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{params.locale === "zh" ? "议程管理" : "Agenda"}</h1>
        <p className="brand-subtitle">{activity.title}</p>
      </div>
      <AdminActivityAgendaClient
        locale={params.locale}
        activityId={params.id}
        initialAgendaItems={agendaItems.map((item) => ({
          ...item,
          agendaDate: item.agendaDate.toISOString(),
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }))}
        speakers={speakers}
      />
    </div>
  );
}
