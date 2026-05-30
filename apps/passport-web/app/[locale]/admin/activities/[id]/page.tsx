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
  const [activity, activityDetail, agendaItems, speakerLinks, allSpeakers, verifiers, availableVerifiers, institutions, availableInstitutions] = await Promise.all([
    prisma.activity.findUnique({
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
    }),
    prisma.activityDetail.findUnique({
      where: { activityId: params.id },
      select: { configJson: true },
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
    prisma.activityVerifier.findMany({
      where: { activityId: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["VERIFIER", "ADMIN", "EVENT_MANAGER"] },
        status: "ACTIVE",
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.activityInstitution.findMany({
      where: { activityId: params.id },
      include: {
        institution: {
          select: { id: true, name: true, nameEn: true, logo: true, website: true },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.institution.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameEn: true, logo: true, website: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      take: 200,
    }),
  ]);

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
          registrationOpenAt: activity.registrationOpenAt ? activity.registrationOpenAt.toISOString() : null,
          registrationCloseAt: activity.registrationCloseAt ? activity.registrationCloseAt.toISOString() : null,
          locationJson:
            activity.locationJson &&
            typeof activity.locationJson === "object" &&
            !Array.isArray(activity.locationJson)
              ? (activity.locationJson as Record<string, string>)
              : null,
        }}
        activityDetailConfig={
          activityDetail?.configJson &&
          typeof activityDetail.configJson === "object" &&
          !Array.isArray(activityDetail.configJson)
            ? activityDetail.configJson
            : null
        }
        agendaItems={agendaItems.map((item) => ({
          ...item,
          agendaDate: item.agendaDate.toISOString(),
        }))}
        allSpeakers={allSpeakers}
        availableInstitutions={availableInstitutions}
        availableVerifiers={availableVerifiers}
        institutions={institutions.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }))}
        locale={params.locale}
        speakerLinks={speakerLinks}
        verifiers={verifiers.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
