import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivityTasksPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/tasks`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const [activity, tasks] = await Promise.all([
    prisma.activity.findUnique({ where: { id: params.id }, select: { id: true, title: true } }),
    prisma.activityTask.findMany({
      where: { activityId: params.id, parentTaskId: null },
      orderBy: { orderIndex: "asc" },
      include: {
        subtasks: { orderBy: { orderIndex: "asc" } },
        _count: { select: { submissions: true, checkinRecords: true } },
      },
    }),
  ]);

  if (!activity) notFound();

  const zh = params.locale === "zh";

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{zh ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{zh ? "任务管理" : "Tasks"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{zh ? "任务管理" : "Task Management"}</h1>
        <p className="brand-subtitle">{activity.title} — {zh ? `共 ${tasks.length} 个主任务` : `${tasks.length} top-level tasks`}</p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "序号" : "#"}</th>
                <th>{zh ? "任务标题" : "Title"}</th>
                <th>{zh ? "类型" : "Type"}</th>
                <th>{zh ? "必选" : "Required"}</th>
                <th>{zh ? "积分" : "Points"}</th>
                <th>{zh ? "截止时间" : "Due"}</th>
                <th>{zh ? "提交 / 签到" : "Subs / Checkins"}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    {zh ? "暂无任务" : "No tasks"}
                  </td>
                </tr>
              ) : (
                tasks.flatMap((task, i) => [
                  <tr key={task.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{task.title}</td>
                    <td><span className="chip chip">{task.taskType}</span></td>
                    <td>{task.isRequired ? (zh ? "是" : "Yes") : (zh ? "否" : "No")}</td>
                    <td>{task.points}</td>
                    <td>{task.dueTime ? new Date(task.dueTime).toLocaleDateString() : "—"}</td>
                    <td>{task._count.submissions} / {task._count.checkinRecords}</td>
                  </tr>,
                  ...task.subtasks.map((sub, j) => (
                    <tr key={sub.id} style={{ background: "var(--color-surface-raised)" }}>
                      <td style={{ paddingLeft: "1.5rem", color: "var(--color-text-muted)" }}>{i + 1}.{j + 1}</td>
                      <td style={{ paddingLeft: "1.5rem" }}>↳ {sub.title}</td>
                      <td><span className="chip chip">{sub.taskType}</span></td>
                      <td>{sub.isRequired ? (zh ? "是" : "Yes") : (zh ? "否" : "No")}</td>
                      <td>{sub.points}</td>
                      <td>{sub.dueTime ? new Date(sub.dueTime).toLocaleDateString() : "—"}</td>
                      <td>—</td>
                    </tr>
                  )),
                ])
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
