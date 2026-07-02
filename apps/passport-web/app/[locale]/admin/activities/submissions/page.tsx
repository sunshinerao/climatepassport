import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivitiesSubmissionsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/submissions`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const submissions = await prisma.activitySubmission.findMany({
    where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
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
        <h1 className="label">{zh ? "作品审核" : "Submission Review"}</h1>
        <p className="brand-subtitle">{zh ? `待审核 ${submissions.length} 件` : `${submissions.length} pending review`}</p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "活动" : "Activity"}</th>
                <th>{zh ? "用户 ID" : "User ID"}</th>
                <th>{zh ? "状态" : "Status"}</th>
                <th>{zh ? "提交时间" : "Submitted"}</th>
                <th>{zh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td><a href={`/${params.locale}/admin/activities/${s.activityId}/submissions`}>{s.activity?.title ?? s.activityId}</a></td>
                  <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>{s.userId}</td>
                  <td><span className="chip cpca-badge cpca-badge-amber">{s.status}</span></td>
                  <td>{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—"}</td>
                  <td>
                    <a  href={`/${params.locale}/admin/activities/${s.activityId}/submissions`}>
                      {zh ? "审核" : "Review"}
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
