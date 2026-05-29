import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivitiesFormTemplatesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/activities/form-templates`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const templates = await prisma.activityFormTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  const zh = params.locale === "zh";

  return (
    <div>
      <div className="section-header">
        <h1 className="label">{zh ? "表单模板" : "Form Templates"}</h1>
        <p className="brand-subtitle">{zh ? `共 ${templates.length} 个模板` : `${templates.length} templates`}</p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "模板名称" : "Name"}</th>
                <th>{zh ? "类型" : "Type"}</th>
                <th>{zh ? "字段数量" : "Fields"}</th>
                <th>{zh ? "创建者" : "Created By"}</th>
                <th>{zh ? "创建时间" : "Created"}</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    {zh ? "暂无表单模板" : "No form templates"}
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td><span className="chip chip">{t.type}</span></td>
                    <td>{Array.isArray(t.fieldsJson) ? (t.fieldsJson as any[]).length : "—"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{t.createdByUserId}</td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
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
