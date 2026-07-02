import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivitySubmissionsPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/submissions`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const [activity, submissions] = await Promise.all([
    prisma.activity.findUnique({ where: { id: params.id }, select: { id: true, title: true } }),
    prisma.activitySubmission.findMany({
      where: { activityId: params.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        task: { select: { id: true, title: true } },
      },
    }),
  ]);

  if (!activity) notFound();

  const zh = params.locale === "zh";

  const STATUS_LABEL: Record<string, string> = {
    DRAFT: zh ? "草稿" : "Draft",
    SUBMITTED: zh ? "已提交" : "Submitted",
    UNDER_REVIEW: zh ? "审核中" : "Under Review",
    APPROVED: zh ? "已通过" : "Approved",
    REJECTED: zh ? "已拒绝" : "Rejected",
    REVISION_REQUIRED: zh ? "需修改" : "Revision Required",
  };

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{zh ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{zh ? "作品审核" : "Submissions"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{zh ? "作品审核" : "Submission Review"}</h1>
        <p className="brand-subtitle">{activity.title} — {zh ? `共 ${submissions.length} 件` : `${submissions.length} submissions`}</p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "用户 ID" : "User ID"}</th>
                <th>{zh ? "所属任务" : "Task"}</th>
                <th>{zh ? "类型" : "Type"}</th>
                <th>{zh ? "状态" : "Status"}</th>
                <th>{zh ? "分数" : "Score"}</th>
                <th>{zh ? "提交时间" : "Submitted"}</th>
                <th>{zh ? "内容" : "Content"}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    {zh ? "暂无作品" : "No submissions"}
                  </td>
                </tr>
              ) : (
                submissions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>{s.userId}</td>
                    <td style={{ fontSize: "var(--cp-text-small)" }}>{s.task?.title ?? "—"}</td>
                    <td>{s.mediaType ?? "—"}</td>
                    <td><span className="chip">{STATUS_LABEL[s.status] ?? s.status}</span></td>
                    <td>{s.score !== null ? s.score?.toString() : "—"}</td>
                    <td>{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—"}</td>
                    <td>
                      {s.linkUrl && (
                        <a href={s.linkUrl} rel="noopener noreferrer" style={{ fontSize: "var(--cp-text-small)" }} target="_blank">
                          {zh ? "链接" : "Link"}
                        </a>
                      )}
                      {s.fileUrls.length > 0 && (
                        <span style={{ fontSize: "var(--cp-text-small)" }}>{zh ? `${s.fileUrls.length} 个文件` : `${s.fileUrls.length} file(s)`}</span>
                      )}
                      {s.textContent && (
                        <span style={{ fontSize: "var(--cp-text-small)", color: "var(--color-text-muted)" }}>{s.textContent.slice(0, 40)}…</span>
                      )}
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
