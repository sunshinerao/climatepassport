import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivitiesTasksPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/tasks`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const tasks = await prisma.activityTask.findMany({
    orderBy: [{ activityId: "asc" }, { orderIndex: "asc" }],
    take: 100,
    include: {
      activity: { select: { id: true, title: true } },
      _count: { select: { submissions: true, checkinRecords: true } },
    },
  });

  const zh = params.locale === "zh";

  return (
    <div>
      <div className="section-header">
        <h1 className="label">{zh ? "任务管理" : "Task Management"}</h1>
        <p className="brand-subtitle">{zh ? `共 ${tasks.length} 个任务` : `${tasks.length} tasks across all activities`}</p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "活动" : "Activity"}</th>
                <th>{zh ? "任务标题" : "Title"}</th>
                <th>{zh ? "类型" : "Type"}</th>
                <th>{zh ? "必选" : "Req."}</th>
                <th>{zh ? "积分" : "Pts"}</th>
                <th>{zh ? "截止" : "Due"}</th>
                <th>{zh ? "提交/签到" : "Subs/Chk"}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontSize: "0.85em" }}>
                    <a href={`/${params.locale}/admin/activities/${t.activityId}/tasks`}>{t.activity?.title ?? t.activityId}</a>
                  </td>
                  <td>{t.title}</td>
                  <td><span className="chip chip">{t.taskType}</span></td>
                  <td>{t.isRequired ? "✓" : "—"}</td>
                  <td>{t.points}</td>
                  <td>{t.dueTime ? new Date(t.dueTime).toLocaleDateString() : "—"}</td>
                  <td>{t._count.submissions} / {t._count.checkinRecords}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
