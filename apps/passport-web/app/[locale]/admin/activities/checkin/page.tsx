import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";
import CsvExportButton from "@/components/csv-export-button";

export default async function AdminActivitiesCheckinPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/checkin`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const records = await prisma.activityCheckinRecord.findMany({
    orderBy: { checkinAt: "desc" },
    take: 100,
    include: {
      activity: { select: { id: true, title: true } },
    },
  });

  const zh = params.locale === "zh";
  const validCount = records.filter((r) => r.status === "VALID").length;

  return (
    <div>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 className="label">{zh ? "签到管理" : "Check-in Management"}</h1>
            <p className="brand-subtitle">{zh ? `最近 ${records.length} 条，有效 ${validCount} 条` : `Recent ${records.length} records, ${validCount} valid`}</p>
          </div>
          <CsvExportButton
          filename="activity-checkins"
          label={zh ? "导出 CSV" : "Export CSV"}
          rows={records.map((r) => ({
            id: r.id,
            activityId: r.activityId,
            activityTitle: r.activity?.title ?? "",
            userId: r.userId,
            taskId: r.taskId ?? "",
            method: r.method,
            status: r.status,
            checkinAt: r.checkinAt.toISOString(),
          }))}
        />
        </div>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "活动" : "Activity"}</th>
                <th>{zh ? "用户 ID" : "User ID"}</th>
                <th>{zh ? "方式" : "Method"}</th>
                <th>{zh ? "状态" : "Status"}</th>
                <th>{zh ? "签到时间" : "Time"}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a href={`/${params.locale}/admin/activities/${r.activityId}/checkin`}>
                      {r.activity?.title ?? r.activityId}
                    </a>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{r.userId}</td>
                  <td><span className="chip chip">{r.method}</span></td>
                  <td>
                    <span className={r.status === "VALID" ? "chip cpca-badge cpca-badge-green" : "chip cpca-badge cpca-badge-amber"}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(r.checkinAt).toLocaleString(zh ? "zh-CN" : "en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
