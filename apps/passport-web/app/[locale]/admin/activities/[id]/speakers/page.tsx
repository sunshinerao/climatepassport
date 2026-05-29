import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminActivitySpeakersClient } from "@/components/admin-activity-speakers-client";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivitySpeakersPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/speakers`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const [activity, speakerLinks, allSpeakers] = await Promise.all([
    prisma.activity.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, type: true },
    }),
    prisma.activitySpeaker.findMany({
      where: { activityId: params.id },
      include: {
        speaker: {
          select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
        },
      },
      orderBy: { order: "asc" },
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
        <span>{params.locale === "zh" ? "嘉宾管理" : "Speakers"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{params.locale === "zh" ? "嘉宾管理" : "Speakers"}</h1>
        <p className="brand-subtitle">{activity.title}</p>
      </div>
      <AdminActivitySpeakersClient
        locale={params.locale}
        activityId={params.id}
        initialSpeakers={speakerLinks}
        allSpeakers={allSpeakers}
      />
    </div>
  );
}
