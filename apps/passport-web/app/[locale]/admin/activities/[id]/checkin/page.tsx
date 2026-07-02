import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivityCheckinPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/checkin`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const [activity, records] = await Promise.all([
    prisma.activity.findUnique({ where: { id: params.id }, select: { id: true, title: true } }),
    prisma.activityCheckinRecord.findMany({
      where: { activityId: params.id },
      orderBy: { checkinAt: "desc" },
      take: 200,
    }),
  ]);

  if (!activity) notFound();

  const zh = params.locale === "zh";
  const validCount = records.filter((r) => r.status === "VALID").length;
  const dupCount = records.filter((r) => r.status === "DUPLICATE").length;

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{zh ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{zh ? "签到管理" : "Check-in"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{zh ? "签到管理" : "Check-in Management"}</h1>
        <p className="brand-subtitle">
          {activity.title} — {zh ? `有效 ${validCount} / 重复 ${dupCount}` : `Valid: ${validCount} / Duplicate: ${dupCount}`}
        </p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "用户 ID" : "User ID"}</th>
                <th>{zh ? "任务" : "Task"}</th>
                <th>{zh ? "方式" : "Method"}</th>
                <th>{zh ? "状态" : "Status"}</th>
                <th>{zh ? "签到时间" : "Check-in Time"}</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    {zh ? "暂无签到记录" : "No check-in records"}
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>{r.userId}</td>
                    <td style={{ fontSize: "var(--cp-text-small)" }}>{r.taskId ?? "—"}</td>
                    <td><span className="chip chip">{r.method}</span></td>
                    <td>
                      <span className={r.status === "VALID" ? "chip cpca-badge cpca-badge-green" : r.status === "DUPLICATE" ? "chip cpca-badge cpca-badge-amber" : "chip cpca-badge cpca-badge-red"}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(r.checkinAt).toLocaleString(zh ? "zh-CN" : "en-US")}</td>
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
