import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";
import { notFound } from "next/navigation";

export default async function AdminActivityAnalyticsPage({
  params,
}: {
  params: { locale: Locale; id: string };
}) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/analytics`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const [activity, participationsByStatus, applicationsByStatus, checkins, taskStats, pointStats] = await Promise.all([
    prisma.activity.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, slug: true, type: true, capacity: true, startTime: true, endTime: true },
    }),
    prisma.activityParticipation.groupBy({
      by: ["status"],
      where: { activityId: params.id },
      _count: { id: true },
    }),
    prisma.activityApplication.groupBy({
      by: ["status"],
      where: { activityId: params.id },
      _count: { id: true },
    }),
    prisma.activityCheckinRecord.findMany({
      where: { activityId: params.id },
      select: { checkinAt: true },
      orderBy: { checkinAt: "asc" },
    }),
    prisma.activityTask.findMany({
      where: { activityId: params.id },
      select: {
        id: true,
        title: true,
        taskType: true,
        _count: { select: { submissions: true } },
      },
    }),
    prisma.pointTransaction.aggregate({
      where: { activityId: params.id },
      _sum: { points: true },
      _count: { id: true },
    }),
  ]);

  if (!activity) notFound();

  const zh = params.locale === "zh";

  // Build participation funnel
  const partMap = Object.fromEntries(participationsByStatus.map((r: { status: string; _count: { id: number } }) => [r.status, r._count.id]));
  const appMap = Object.fromEntries(applicationsByStatus.map((r: { status: string; _count: { id: number } }) => [r.status, r._count.id]));

  const totalApplications = Object.values(appMap).reduce((s, v) => s + v, 0);
  const totalParticipations = Object.values(partMap).reduce((s, v) => s + v, 0);
  const completedCount = partMap["COMPLETED"] ?? 0;
  const certifiedCount = partMap["CERTIFIED"] ?? 0;

  // Checkin by date (group by calendar day)
  const checkinByDay: Record<string, number> = {};
  for (const c of checkins) {
    const day = c.checkinAt.toISOString().slice(0, 10);
    checkinByDay[day] = (checkinByDay[day] ?? 0) + 1;
  }
  const checkinDays = Object.entries(checkinByDay).sort((a, b) => a[0].localeCompare(b[0]));

  const totalPoints = pointStats._sum.points ?? 0;
  const totalPointTxns = pointStats._count.id;

  const capacityFillPct =
    activity.capacity && totalParticipations > 0
      ? Math.min(100, Math.round((totalParticipations / activity.capacity) * 100))
      : null;

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{zh ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{zh ? "数据分析" : "Analytics"}</span>
      </nav>

      <div className="section-header">
        <h1 className="label">{zh ? "活动数据分析" : "Activity Analytics"}</h1>
        <p className="brand-subtitle">{activity.title}</p>
      </div>

      {/* Overview stats */}
      <div className="metric-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="data-card">
          <span >{zh ? "总申请" : "Applications"}</span>
          <span >{totalApplications}</span>
        </div>
        <div className="data-card">
          <span >{zh ? "总参与" : "Participations"}</span>
          <span >{totalParticipations}</span>
          {capacityFillPct !== null && (
            <span style={{ fontSize: "var(--cp-text-caption)", color: "var(--color-text-muted)" }}>
              {zh ? `名额占用 ${capacityFillPct}%` : `${capacityFillPct}% capacity`}
            </span>
          )}
        </div>
        <div className="data-card">
          <span >{zh ? "已完成" : "Completed"}</span>
          <span >{completedCount}</span>
        </div>
        <div className="data-card">
          <span >{zh ? "已获证书" : "Certified"}</span>
          <span >{certifiedCount}</span>
        </div>
        <div className="data-card">
          <span >{zh ? "总签到次数" : "Check-ins"}</span>
          <span >{checkins.length}</span>
        </div>
        <div className="data-card">
          <span >{zh ? "积分发放" : "Points Issued"}</span>
          <span >{totalPoints}</span>
          <span style={{ fontSize: "var(--cp-text-caption)", color: "var(--color-text-muted)" }}>
            {zh ? `${totalPointTxns} 笔` : `${totalPointTxns} txns`}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Application funnel */}
        <div className="section">
          <h2 className="section-header">{zh ? "申请漏斗" : "Application Funnel"}</h2>
          {totalApplications === 0 ? (
            <div className="form-error form-success">{zh ? "暂无申请数据" : "No application data"}</div>
          ) : (
            <table className="tableish">
              <thead>
                <tr>
                  <th>{zh ? "状态" : "Status"}</th>
                  <th>{zh ? "数量" : "Count"}</th>
                  <th>{zh ? "占比" : "%"}</th>
                </tr>
              </thead>
              <tbody>
                {applicationsByStatus.map((row) => (
                  <tr key={row.status}>
                    <td><span className="chip chip">{row.status}</span></td>
                    <td>{row._count.id}</td>
                    <td>{Math.round((row._count.id / totalApplications) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Participation by status */}
        <div className="section">
          <h2 className="section-header">{zh ? "参与状态分布" : "Participation Status"}</h2>
          {totalParticipations === 0 ? (
            <div className="form-error form-success">{zh ? "暂无参与数据" : "No participation data"}</div>
          ) : (
            <table className="tableish">
              <thead>
                <tr>
                  <th>{zh ? "状态" : "Status"}</th>
                  <th>{zh ? "数量" : "Count"}</th>
                  <th>{zh ? "占比" : "%"}</th>
                </tr>
              </thead>
              <tbody>
                {participationsByStatus.map((row) => (
                  <tr key={row.status}>
                    <td><span className="chip chip">{row.status}</span></td>
                    <td>{row._count.id}</td>
                    <td>{Math.round((row._count.id / totalParticipations) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Checkin timeline */}
      {checkinDays.length > 0 && (
        <div className="section">
          <h2 className="section-header">{zh ? "签到时间分布" : "Check-in Timeline"}</h2>
          <div >
            <table className="tableish">
              <thead>
                <tr>
                  <th>{zh ? "日期" : "Date"}</th>
                  <th>{zh ? "签到次数" : "Check-ins"}</th>
                  <th>{zh ? "条形图" : "Bar"}</th>
                </tr>
              </thead>
              <tbody>
                {checkinDays.map(([day, count]) => {
                  const max = Math.max(...checkinDays.map((d) => d[1]));
                  const pct = Math.round((count / max) * 100);
                  return (
                    <tr key={day}>
                      <td style={{ fontFamily: "var(--cp-font-mono)" }}>{day}</td>
                      <td>{count}</td>
                      <td>
                        <div style={{ background: "var(--color-border)", borderRadius: "2px", height: "8px", width: "100%" }}>
                          <div style={{ background: "var(--color-primary, #2563eb)", borderRadius: "2px", height: "8px", width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task completion rates */}
      {taskStats.length > 0 && (
        <div className="section">
          <h2 className="section-header">{zh ? "任务完成率" : "Task Completion Rates"}</h2>
          <div >
            <table className="tableish">
              <thead>
                <tr>
                  <th>{zh ? "任务" : "Task"}</th>
                  <th>{zh ? "类型" : "Type"}</th>
                  <th>{zh ? "提交数" : "Submissions"}</th>
                  {totalParticipations > 0 && <th>{zh ? "完成率" : "Rate"}</th>}
                </tr>
              </thead>
              <tbody>
                {taskStats.map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td><span className="chip chip">{t.taskType}</span></td>
                    <td>{t._count.submissions}</td>
                    {totalParticipations > 0 && (
                      <td>{Math.min(100, Math.round((t._count.submissions / totalParticipations) * 100))}%</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export links */}
      <div className="section">
        <h2 className="section-header">{zh ? "数据导出" : "Export"}</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a
            href={`/api/activity-participations?activityId=${params.id}&format=csv`}
            className="button button"
            download
          >
            {zh ? "⬇ 导出参与记录 (CSV)" : "⬇ Export Participations (CSV)"}
          </a>
          <a
            href={`/api/activity-applications?activityId=${params.id}&format=csv`}
            className="button button"
            download
          >
            {zh ? "⬇ 导出申请记录 (CSV)" : "⬇ Export Applications (CSV)"}
          </a>
        </div>
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
          <a href={`/${params.locale}/admin/activities/${params.id}/rewards`} className="button button">
            {zh ? "奖励规则" : "Reward Rules"}
          </a>
        </div>
      </div>
    </div>
  );
}
