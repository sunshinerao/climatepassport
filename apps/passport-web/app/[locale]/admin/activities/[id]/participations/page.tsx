import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivityParticipationsPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/participations`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const [activity, participations] = await Promise.all([
    prisma.activity.findUnique({ where: { id: params.id }, select: { id: true, title: true } }),
    prisma.activityParticipation.findMany({
      where: { activityId: params.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!activity) notFound();

  const zh = params.locale === "zh";

  const STATUS_LABEL: Record<string, string> = {
    REGISTERED: zh ? "已注册" : "Registered",
    ACCEPTED: zh ? "已接受" : "Accepted",
    CHECKED_IN: zh ? "已签到" : "Checked In",
    IN_PROGRESS: zh ? "进行中" : "In Progress",
    COMPLETED: zh ? "已完成" : "Completed",
    FAILED: zh ? "未完成" : "Failed",
    ABSENT: zh ? "缺席" : "Absent",
    CERTIFIED: zh ? "已认证" : "Certified",
    ARCHIVED: zh ? "已归档" : "Archived",
  };

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{zh ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{zh ? "参与管理" : "Participations"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{zh ? "参与管理" : "Participation Management"}</h1>
        <p className="brand-subtitle">{activity.title} — {zh ? `共 ${participations.length} 人` : `${participations.length} participants`}</p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "用户 ID" : "User ID"}</th>
                <th>{zh ? "角色" : "Role"}</th>
                <th>{zh ? "状态" : "Status"}</th>
                <th>{zh ? "积分" : "Points"}</th>
                <th>{zh ? "护照同步" : "Passport"}</th>
                <th>{zh ? "完成时间" : "Completed"}</th>
              </tr>
            </thead>
            <tbody>
              {participations.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    {zh ? "暂无参与记录" : "No participation records"}
                  </td>
                </tr>
              ) : (
                participations.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>{p.userId}</td>
                    <td>{p.roleType ?? "—"}</td>
                    <td><span className="chip">{STATUS_LABEL[p.status] ?? p.status}</span></td>
                    <td>{p.pointsEarned}</td>
                    <td>{p.passportSynced ? (zh ? "是" : "Yes") : (zh ? "否" : "No")}</td>
                    <td>{p.completedAt ? new Date(p.completedAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
