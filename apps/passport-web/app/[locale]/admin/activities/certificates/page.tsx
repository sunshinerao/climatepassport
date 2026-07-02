import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivitiesCertificatesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/activities/certificates`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const rules = await prisma.activityCertificateRule.findMany({
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
        <h1 className="label">{zh ? "证书规则" : "Certificate Rules"}</h1>
        <p className="brand-subtitle">{zh ? `共 ${rules.length} 条规则` : `${rules.length} rules configured`}</p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "活动" : "Activity"}</th>
                <th>{zh ? "证书定义 ID" : "Certificate Definition ID"}</th>
                <th>{zh ? "自动签发" : "Auto Issue"}</th>
                <th>{zh ? "条件" : "Condition"}</th>
                <th>{zh ? "创建时间" : "Created"}</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    {zh ? "暂无证书规则" : "No certificate rules configured"}
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <a href={`/${params.locale}/admin/activities/${r.activityId}`}>{r.activity?.title ?? r.activityId}</a>
                    </td>
                    <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>{r.certificateDefinitionId}</td>
                    <td>{r.autoIssue ? (zh ? "是" : "Yes") : (zh ? "否" : "No")}</td>
                    <td style={{ fontSize: "var(--cp-text-small)" }}>{r.conditionJson ? JSON.stringify(r.conditionJson) : "—"}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
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
