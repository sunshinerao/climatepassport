import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivitiesReviewsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/reviews`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const workflows = await prisma.activityReviewWorkflow.findMany({
    where: { status: "PENDING" },
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
        <h1 className="label">{zh ? "评审工作流" : "Review Workflows"}</h1>
        <p className="brand-subtitle">{zh ? `待处理 ${workflows.length} 项` : `${workflows.length} pending reviews`}</p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "活动" : "Activity"}</th>
                <th>{zh ? "对象类型" : "Object Type"}</th>
                <th>{zh ? "对象 ID" : "Object ID"}</th>
                <th>{zh ? "评审类型" : "Review Type"}</th>
                <th>{zh ? "状态" : "Status"}</th>
                <th>{zh ? "创建时间" : "Created"}</th>
              </tr>
            </thead>
            <tbody>
              {workflows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    {zh ? "暂无待处理评审" : "No pending reviews"}
                  </td>
                </tr>
              ) : (
                workflows.map((w) => (
                  <tr key={w.id}>
                    <td><a href={`/${params.locale}/admin/activities/${w.activityId}`}>{w.activity?.title ?? w.activityId}</a></td>
                    <td><span className="chip chip">{w.objectType}</span></td>
                    <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>{w.objectId.slice(0, 12)}…</td>
                    <td>{w.reviewType}</td>
                    <td><span className="chip cpca-badge cpca-badge-amber">{w.status}</span></td>
                    <td>{new Date(w.createdAt).toLocaleDateString()}</td>
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
