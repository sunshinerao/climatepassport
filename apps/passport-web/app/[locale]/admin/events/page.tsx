import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { AdminEventsManager } from "@/components/admin-events-manager";
import { serializeAdminEvent } from "@/lib/server/admin-events";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedAdminEventsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const user = await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/events`);
  const prisma = getPrismaClient();

  const [events, managers] = prisma
    ? await Promise.all([
        prisma.event.findMany({
          where: user.role === "ADMIN" ? undefined : { managerUserId: user.id },
          orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
          include: {
            manager: { select: { name: true } },
            _count: { select: { registrations: true } },
          },
        }),
        prisma.user.findMany({
          where: {
            role: { in: ["ADMIN", "EVENT_MANAGER"] },
            status: "ACTIVE",
          },
          orderBy: [{ role: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            role: true,
          },
        }),
      ])
    : [[], []];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "活动后台" : "Event admin"}</span>
          <h1>{params.locale === "zh" ? "可运行的活动管理" : "Runnable event management"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "这个页面已经连上真实数据库、真实角色门禁和真实会话。可以直接创建新活动，也可以编辑自己有权限管理的活动。"
            : "This page is now connected to the live database, live role gates, and live sessions. You can create new events and update the events your role is allowed to manage."}
        </p>
      </div>

      <section className="section panel">
        <span className="label">{params.locale === "zh" ? "后台快捷入口" : "Admin quick links"}</span>
        <div className="certificate-operation-links">
          <Link href={`/${params.locale}/admin`}>{params.locale === "zh" ? "控制台总览" : "Dashboard"}</Link>
          <Link href={`/${params.locale}/admin/events`}>{params.locale === "zh" ? "活动管理" : "Event management"}</Link>
          <Link href={`/${params.locale}/admin/learning-experiences`}>{params.locale === "zh" ? "学习项目" : "Learning experiences"}</Link>
          {user.role === "ADMIN" ? (
            <Link href={`/${params.locale}/admin/summer-school/applications`}>
              {params.locale === "zh" ? "夏校申请" : "Summer school apps"}
            </Link>
          ) : null}
          {user.role === "ADMIN" ? (
            <Link href={`/${params.locale}/admin/certificates`}>
              {params.locale === "zh" ? "证书中心" : "Certificate hub"}
            </Link>
          ) : null}
        </div>
      </section>

      <AdminEventsManager
        initialEvents={events.map(serializeAdminEvent)}
        locale={params.locale}
        managers={managers}
        userRole={user.role}
      />
    </>
  );
}
