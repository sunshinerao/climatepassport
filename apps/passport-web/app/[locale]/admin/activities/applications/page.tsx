import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";
import CsvExportButton from "@/components/csv-export-button";

export default async function AdminActivityApplicationsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/applications`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const applications = await prisma.activityApplication.findMany({
    where: { status: { in: ["SUBMITTED", "PENDING_REVIEW"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      activity: { select: { id: true, title: true, type: true } },
    },
  });

  const zh = params.locale === "zh";

  const STATUS_LABEL: Record<string, string> = {
    SUBMITTED: zh ? "已提交" : "Submitted",
    PENDING_REVIEW: zh ? "审核中" : "Pending Review",
    APPROVED: zh ? "已通过" : "Approved",
    REJECTED: zh ? "已拒绝" : "Rejected",
    WAITLISTED: zh ? "候补" : "Waitlisted",
    CANCELLED: zh ? "已取消" : "Cancelled",
    WITHDRAWN: zh ? "已撤回" : "Withdrawn",
    DRAFT: zh ? "草稿" : "Draft",
  };

  return (
    <div>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 className="label">{zh ? "报名审核" : "Application Review"}</h1>
            <p className="brand-subtitle">{zh ? `待审核申请：${applications.length} 条` : `Pending applications: ${applications.length}`}</p>
          </div>
          <CsvExportButton
            filename="activity-applications"
            label={zh ? "导出 CSV" : "Export CSV"}
            rows={applications.map((a) => ({
              id: a.id,
              activityId: a.activityId,
              activityTitle: a.activity?.title ?? "",
              userId: a.userId,
              roleType: a.roleType ?? "",
              status: a.status,
              submittedAt: a.submittedAt?.toISOString() ?? "",
              createdAt: a.createdAt.toISOString(),
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
                <th>{zh ? "角色类型" : "Role Type"}</th>
                <th>{zh ? "状态" : "Status"}</th>
                <th>{zh ? "提交时间" : "Submitted"}</th>
                <th>{zh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    {zh ? "暂无待审核申请" : "No pending applications"}
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <a href={`/${params.locale}/admin/activities/${app.activityId}`}>{app.activity?.title ?? app.activityId}</a>
                    </td>
                    <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>{app.userId}</td>
                    <td>{app.roleType ?? "—"}</td>
                    <td>
                      <span className="chip">{STATUS_LABEL[app.status] ?? app.status}</span>
                    </td>
                    <td>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "—"}</td>
                    <td>
                      <a  href={`/${params.locale}/admin/activities/${app.activityId}/applications`}>
                        {zh ? "详情" : "View"}
                      </a>
                    </td>
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
