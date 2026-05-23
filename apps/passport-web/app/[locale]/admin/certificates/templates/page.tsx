import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateTemplatesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/templates`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";

  const templates = prisma
    ? await prisma.certificateTemplate.findMany({
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        include: { category: true, definitions: { select: { id: true } } },
      })
    : [];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "模板管理" : "Template Management"}</span>
          <h1>{isZh ? "证书模板与预览" : "Certificate templates and preview"}</h1>
        </div>
        <p>{isZh ? "第一阶段提供配置表单和预览占位；复杂可视化编辑器在后续阶段增强。" : "Phase 1 uses configuration summaries and preview placeholders; a deeper visual editor comes later."}</p>
      </div>

      <section className="section certificate-card-grid">
        {templates.map((template) => (
          <article className="certificate-card" key={template.id}>
            <div className="certificate-card-top">
              <span className="status-badge">{template.isActive ? (isZh ? "启用" : "Active") : (isZh ? "停用" : "Inactive")}</span>
              <span>v{template.version}</span>
            </div>
            <h3>{getCertificateName(params.locale, template)}</h3>
            <p>{getCertificateName(params.locale, template.category)} · {template.templateType}</p>
            <dl className="certificate-meta-grid">
              <div>
                <dt>{isZh ? "定义数" : "Definitions"}</dt>
                <dd>{template.definitions.length}</dd>
              </div>
              <div>
                <dt>{isZh ? "语言" : "Language"}</dt>
                <dd>{template.nameEn ? (isZh ? "中英" : "Bilingual") : (isZh ? "中文" : "Primary")}</dd>
              </div>
            </dl>
            <div className="certificate-template-preview">
              <span>Climate Passport</span>
              <strong>{getCertificateName(params.locale, template)}</strong>
              <small>{isZh ? "预览区域" : "Preview area"}</small>
            </div>
            <div className="button-row">
              <Link className="button-outline" href={`/${params.locale}/admin/certificates/templates/${template.id}`}>
                {isZh ? "编辑与预览" : "Edit and preview"}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
