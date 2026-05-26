import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireRoleAccess } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedAdminPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const user = await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin`);
  const prisma = getPrismaClient();
  const isPlatformAdmin = user.role === "ADMIN";

  const [managedCount, publishedCount, pendingApprovalCount, recentEvents] = prisma
    ? await Promise.all([
        prisma.event.count({ where: user.role === "ADMIN" ? undefined : { managerUserId: user.id } }),
        prisma.event.count({ where: { isPublished: true, ...(user.role === "ADMIN" ? {} : { managerUserId: user.id }) } }),
        prisma.event.count({ where: { requireApproval: true, isClosed: false, ...(user.role === "ADMIN" ? {} : { managerUserId: user.id }) } }),
        prisma.event.findMany({
          where: user.role === "ADMIN" ? undefined : { managerUserId: user.id },
          take: 5,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            titleEn: true,
            startDate: true,
            isPublished: true,
            requireApproval: true,
          },
        }),
      ])
    : [0, 0, 0, []];

  return (
    <>
      <section className="proto-admin-metrics">
        <article>
          <span>{params.locale === "zh" ? "角色" : "Role"}</span>
          <strong>{user.role}</strong>
        </article>
        <article>
          <span>{params.locale === "zh" ? "可管理活动" : "Managed events"}</span>
          <strong>{managedCount}</strong>
        </article>
        <article>
          <span>{params.locale === "zh" ? "已发布活动" : "Published events"}</span>
          <strong>{publishedCount}</strong>
        </article>
        <article>
          <span>{params.locale === "zh" ? "待审批活动" : "Approval-gated"}</span>
          <strong>{pendingApprovalCount}</strong>
        </article>
      </section>

      <section className="proto-admin-panel">
        <div className="proto-admin-panel-head">
          <h2>{params.locale === "zh" ? "近期活动更新" : "Recent event updates"}</h2>
          <Link href={`/${params.locale}/admin/events`}>{params.locale === "zh" ? "打开编辑台" : "Open editor"}</Link>
        </div>
        <div className="proto-admin-queue">
          {(recentEvents as Array<{ id: string; title: string; titleEn: string | null; startDate: Date; isPublished: boolean; requireApproval: boolean }>).map((event) => (
            <article key={event.id}>
              <div>
                <strong>{params.locale === "zh" ? event.title : event.titleEn ?? event.title}</strong>
                <p>{new Date(event.startDate).toLocaleDateString()}</p>
              </div>
              <div className="proto-admin-tags">
                <span>{event.isPublished ? (params.locale === "zh" ? "已发布" : "Published") : (params.locale === "zh" ? "草稿" : "Draft")}</span>
                <span>{event.requireApproval ? (params.locale === "zh" ? "需审批" : "Approval") : (params.locale === "zh" ? "自动通过" : "Auto")}</span>
              </div>
            </article>
          ))}
          {(recentEvents as unknown[]).length === 0 ? (
            <p className="proto-admin-empty">{params.locale === "zh" ? "暂无活动记录" : "No event records"}</p>
          ) : null}
        </div>
      </section>

      <section className="proto-admin-modules">
        <Link href={`/${params.locale}/admin/events`}>
          <h3>{params.locale === "zh" ? "活动运营模块" : "Event operations"}</h3>
          <p>{params.locale === "zh" ? "创建、更新时间表、发布并控制报名策略。" : "Create events, update schedules, publish and control registration policies."}</p>
        </Link>
        <Link href={`/${params.locale}/admin/learning-experiences`}>
          <h3>{params.locale === "zh" ? "Learning Experiences" : "Learning Experiences"}</h3>
          <p>{params.locale === "zh" ? "维护 program/application 生命周期和 cohort 状态。" : "Maintain program/application lifecycle and cohort statuses."}</p>
        </Link>
        {isPlatformAdmin ? (
          <Link href={`/${params.locale}/admin/certificates`}>
            <h3>{params.locale === "zh" ? "Certificate Hub" : "Certificate Hub"}</h3>
            <p>{params.locale === "zh" ? "配置证书模板、签发流程与验真策略。" : "Configure templates, issuance workflows and verification policy."}</p>
          </Link>
        ) : null}
        {isPlatformAdmin ? (
          <Link href={`/${params.locale}/admin/system`}>
            <h3>{params.locale === "zh" ? "系统管理" : "System settings"}</h3>
            <p>{params.locale === "zh" ? "维护站点名称、Logo（彩色/反白）和全局对外信息。" : "Manage site name, dual logos (color/mono), and global public-facing profile."}</p>
          </Link>
        ) : null}
      </section>
    </>
  );
}
