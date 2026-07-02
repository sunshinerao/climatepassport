import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";
import AdminProjectMilestonesClient from "@/components/admin-project-milestones-client";

export default async function AdminActivityMilestonesPage({
  params,
}: {
  params: { locale: Locale; id: string };
}) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/milestones`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const [activity, milestones] = await Promise.all([
    prisma.activity.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, slug: true, type: true },
    }),
    prisma.projectMilestone.findMany({
      where: { activityId: params.id },
      include: { deliverables: true },
      orderBy: { orderIndex: "asc" },
    }),
  ]);

  if (!activity) throw new Error("Activity not found");

  const zh = params.locale === "zh";

  // Serialize dates for client
  const serializedMilestones = milestones.map((m) => ({
    ...m,
    dueDate: m.dueDate ? m.dueDate.toISOString() : null,
  }));

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{zh ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{zh ? "项目里程碑" : "Milestones"}</span>
      </nav>

      <div className="section-header">
        <h1 className="label">{zh ? "项目里程碑管理" : "Project Milestones"}</h1>
        <p className="brand-subtitle">
          {zh ? `活动：${activity.title}` : `Activity: ${activity.title}`}
        </p>
        {activity.type !== "PROJECT" && (
          <div className="form-error form-success" style={{ marginTop: "0.75rem" }}>
            {zh
              ? `提示：此功能主要适用于 PROJECT 类型活动（当前类型：${activity.type}）。`
              : `Note: This feature is designed for PROJECT type activities (current type: ${activity.type}).`}
          </div>
        )}
      </div>

      <div className="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 className="section-header">{zh ? "里程碑列表" : "Milestones"}</h2>
          <span className="chip chip">
            {zh ? `${milestones.length} 个里程碑` : `${milestones.length} milestones`}
          </span>
        </div>

        <AdminProjectMilestonesClient
          activityId={params.id}
          locale={params.locale}
          milestones={serializedMilestones}
        />
      </div>

      <div className="section">
        <h2 className="section-header">{zh ? "成果提交（Deliverables）" : "Deliverables"}</h2>
        {milestones.length === 0 ? (
          <div className="form-error form-success">
            {zh ? "请先创建里程碑后，再查看成果提交详情。" : "Create milestones first to track deliverables."}
          </div>
        ) : (
          <div >
            <table className="tableish">
              <thead>
                <tr>
                  <th>{zh ? "里程碑" : "Milestone"}</th>
                  <th>{zh ? "成果件 ID" : "Deliverable ID"}</th>
                  <th>{zh ? "状态" : "Status"}</th>
                  <th>{zh ? "关联提交" : "Linked Submission"}</th>
                </tr>
              </thead>
              <tbody>
                {milestones.flatMap((m) =>
                  m.deliverables.length === 0 ? (
                    <tr key={m.id + "-empty"}>
                      <td>{m.title}</td>
                      <td colSpan={3} style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                        {zh ? "暂无成果件" : "No deliverables"}
                      </td>
                    </tr>
                  ) : m.deliverables.map((d) => (
                    <tr key={d.id}>
                      <td>{m.title}</td>
                      <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>{d.id}</td>
                      <td>
                        <span className={`chip ${d.status === "approved" ? "cpca-badge cpca-badge-green" : d.status === "submitted" ? "cpca-badge cpca-badge-blue" : "chip"}`}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>
                        {d.submissionId ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-header">{zh ? "快速导航" : "Quick Links"}</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a href={`/${params.locale}/admin/activities/${params.id}`} className="button button">
            {zh ? "← 活动详情" : "← Activity Detail"}
          </a>
          <a href={`/${params.locale}/admin/activities/${params.id}/participations`} className="button button">
            {zh ? "参与记录" : "Participations"}
          </a>
          <a href={`/${params.locale}/admin/activities/${params.id}/tasks`} className="button button">
            {zh ? "任务管理" : "Tasks"}
          </a>
        </div>
      </div>
    </div>
  );
}
