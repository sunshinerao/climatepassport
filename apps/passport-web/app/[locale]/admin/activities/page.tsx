import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminActivitiesClient } from "@/components/admin-activities-client";
import type { Locale } from "@/lib/site-content";

const TYPE_ORDER = ["EVENT", "LEARNING", "CHALLENGE", "TASK", "PROJECT", "COURSE"] as const;

const TYPE_META: Record<string, { zhLabel: string; enLabel: string; zhDesc: string; enDesc: string }> = {
  EVENT:     { zhLabel: "活动",           enLabel: "Events",             zhDesc: "管理所有线上/线下活动、论坛、峰会",               enDesc: "Manage events, forums, and summits" },
  LEARNING:  { zhLabel: "学习体验",       enLabel: "Learning Experiences", zhDesc: "管理学习项目、课程、培训计划",                  enDesc: "Manage learning programs and courses" },
  CHALLENGE: { zhLabel: "挑战行动",       enLabel: "Challenges",         zhDesc: "管理气候行动挑战、积分任务与排行榜",            enDesc: "Manage climate action challenges" },
  PROJECT:   { zhLabel: "项目孵化",       enLabel: "Projects",           zhDesc: "管理协作项目、里程碑与成果交付",                enDesc: "Manage collaborative projects" },
  TASK:      { zhLabel: "任务",           enLabel: "Tasks",              zhDesc: "管理独立任务单元",                              enDesc: "Manage standalone task units" },
  COURSE:    { zhLabel: "课程",           enLabel: "Courses",            zhDesc: "管理结构化课程与学习路径",                      enDesc: "Manage structured courses" },
};

const STATUS_ORDER = ["PUBLISHED", "DRAFT", "ONGOING", "COMPLETED", "CANCELLED", "ARCHIVED"];

export default async function AdminActivitiesPage({
  params,
}: {
  params: { locale: Locale };
}) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const activities = await prisma.activity.findMany({
    orderBy: [{ isPinned: "desc" as const }, { isFeatured: "desc" as const }, { createdAt: "desc" as const }],
    take: 500,
    select: {
      id: true,
      type: true,
      title: true,
      titleEn: true,
      slug: true,
      status: true,
      visibility: true,
      startTime: true,
      endTime: true,
      timezone: true,
      locationType: true,
      locationJson: true,
      onlineUrl: true,
      isFeatured: true,
      isPinned: true,
      isPrivate: true,
      capacity: true,
      description: true,
      descriptionEn: true,
      createdAt: true,
      _count: {
        select: {
          applications: true,
          participations: true,
        },
      },
    } as any,
  });

  // Build stats
  const stats = {
    total: activities.length,
    published: activities.filter((a: any) => a.status === "PUBLISHED").length,
    draft: activities.filter((a: any) => a.status === "DRAFT").length,
    ongoing: activities.filter((a: any) => a.status === "ONGOING").length,
    completed: activities.filter((a: any) => a.status === "COMPLETED").length,
    archived: activities.filter((a: any) => a.status === "ARCHIVED").length,
  };

  // Group by type
  const grouped: Record<string, any[]> = {};
  for (const type of TYPE_ORDER) {
    grouped[type] = activities.filter((a: any) => a.type === type);
  }

  const zh = params.locale === "zh";

  return (
    <AdminActivitiesClient
      activities={activities.map((a: any) => ({
        ...a,
        startTime: a.startTime ? a.startTime.toISOString() : null,
        endTime: a.endTime ? a.endTime.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
      }))}
      grouped={Object.fromEntries(
        TYPE_ORDER.map((type) => [
          type,
          grouped[type].map((a: any) => ({
            ...a,
            startTime: a.startTime ? a.startTime.toISOString() : null,
            endTime: a.endTime ? a.endTime.toISOString() : null,
            createdAt: a.createdAt.toISOString(),
          })),
        ])
      )}
      locale={params.locale}
      stats={stats}
      typeMeta={TYPE_META}
      typeOrder={TYPE_ORDER as unknown as string[]}
    />
  );
}
