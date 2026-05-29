import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminActivitiesClient } from "@/components/admin-activities-client";
import type { Locale } from "@/lib/site-content";

const TYPE_META: Record<string, { zhLabel: string; enLabel: string; zhDesc: string; enDesc: string }> = {
  EVENT:     { zhLabel: "活动管理",   enLabel: "Events",          zhDesc: "管理所有线上/线下活动、论坛、峰会",           enDesc: "Manage events, forums, and summits" },
  LEARNING:  { zhLabel: "学习体验",   enLabel: "Learning",        zhDesc: "管理学习项目、课程、培训计划的申请与参与",       enDesc: "Manage learning programs, applications, and participation" },
  CHALLENGE: { zhLabel: "挑战行动",   enLabel: "Challenges",      zhDesc: "管理气候行动挑战、积分任务与排行榜",           enDesc: "Manage climate action challenges and leaderboards" },
  PROJECT:   { zhLabel: "项目孵化",   enLabel: "Projects",        zhDesc: "管理协作项目、里程碑与成果交付",              enDesc: "Manage collaborative projects and milestones" },
  COURSE:    { zhLabel: "课程管理",   enLabel: "Courses",         zhDesc: "管理结构化课程与学习路径",                  enDesc: "Manage structured courses and learning paths" },
  TASK:      { zhLabel: "任务管理",   enLabel: "Tasks",           zhDesc: "管理独立任务单元",                        enDesc: "Manage standalone task units" },
};

export default async function AdminActivitiesPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams: { type?: string };
}) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const typeFilter = searchParams.type && Object.keys(TYPE_META).includes(searchParams.type)
    ? (searchParams.type as any)
    : undefined;

  const [total, activities] = await Promise.all([
    prisma.activity.count({ where: typeFilter ? { type: typeFilter } : undefined }),
    prisma.activity.findMany({
      where: typeFilter ? { type: typeFilter } : undefined,
      orderBy: [{ isPinned: "desc" }, { isFeatured: "desc" }, { createdAt: "desc" }],
      take: 200,
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
        locationType: true,
        isFeatured: true,
        isPinned: true,
        isPrivate: true,
        eventLayer: true,
        capacity: true,
        createdAt: true,
        _count: {
          select: {
            applications: true,
            participations: true,
          },
        },
      } as any,
    }),
  ]);

  const zh = params.locale === "zh";
  const meta = typeFilter ? TYPE_META[typeFilter] : null;
  const pageTitle = meta ? (zh ? meta.zhLabel : meta.enLabel) : (zh ? "活动中心" : "Activity Center");
  const pageDesc  = meta ? (zh ? meta.zhDesc  : meta.enDesc)  : (zh ? "管理所有活动项目、报名申请和参与记录" : "Manage all activities, applications, and participation records");

  return (
    <div>
      <div className="section-header">
        <h1 className="label">{pageTitle}</h1>
        <p className="brand-subtitle">{pageDesc}</p>
      </div>
      <AdminActivitiesClient
        activities={activities.map((a: any) => ({
          ...a,
          startTime: a.startTime ? a.startTime.toISOString() : null,
          endTime: a.endTime ? a.endTime.toISOString() : null,
          createdAt: a.createdAt.toISOString(),
        }))}
        locale={params.locale}
        total={total}
        typeFilter={typeFilter ?? null}
      />
    </div>
  );
}
