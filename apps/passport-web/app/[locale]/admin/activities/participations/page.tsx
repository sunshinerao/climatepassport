import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";
import CsvExportButton from "@/components/csv-export-button";

export default async function AdminActivitiesParticipationsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/participations`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const participations = await prisma.activityParticipation.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      activity: { select: { id: true, title: true } },
    },
  });

  const zh = params.locale === "zh";

  return (
    <div>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 className="label">{zh ? "参与管理" : "Participation Management"}</h1>
            <p className="brand-subtitle">{zh ? `最近 ${participations.length} 条参与记录` : `Recent ${participations.length} participation records`}</p>
          </div>
          <CsvExportButton
            filename="activity-participations"
            label={zh ? "导出 CSV" : "Export CSV"}
            rows={participations.map((p) => ({
              id: p.id,
              activityId: p.activityId,
              activityTitle: p.activity?.title ?? "",
              userId: p.userId,
              status: p.status,
              pointsEarned: p.pointsEarned,
              badgeCount: p.badgeAwardIds.length,
              hasCertificate: p.certificateIssueId ? "yes" : "no",
              passportSynced: p.passportSynced ? "yes" : "no",
              completedAt: p.completedAt?.toISOString() ?? "",
              createdAt: p.createdAt.toISOString(),
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
                <th>{zh ? "状态" : "Status"}</th>
                <th>{zh ? "积分" : "Points"}</th>
                <th>{zh ? "护照同步" : "Passport"}</th>
                <th>{zh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {participations.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a href={`/${params.locale}/admin/activities/${p.activityId}`}>{p.activity?.title ?? p.activityId}</a>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{p.userId}</td>
                  <td><span className="chip">{p.status}</span></td>
                  <td>{p.pointsEarned}</td>
                  <td>{p.passportSynced ? (zh ? "是" : "Yes") : (zh ? "否" : "No")}</td>
                  <td>
                    <a  href={`/${params.locale}/admin/activities/${p.activityId}/participations`}>
                      {zh ? "详情" : "View"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
