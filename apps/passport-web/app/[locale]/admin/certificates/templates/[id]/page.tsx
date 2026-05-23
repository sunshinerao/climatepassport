import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateTemplateDetailPage({
  params,
}: {
  params: { locale: Locale; id: string };
}) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/templates/${params.id}`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";
  const template = prisma
    ? await prisma.certificateTemplate.findUnique({
        where: { id: params.id },
        include: { category: true, definitions: true },
      })
    : null;

  if (!template) {
    notFound();
  }

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "模板编辑" : "Template Editor"}</span>
          <h1>{getCertificateName(params.locale, template)}</h1>
        </div>
        <p>{isZh ? "配置字段、签名、盖章、二维码位置、编号格式和页面尺寸将在渲染阶段接入。" : "Field configuration, signature, seal, QR placement, number format, and page size connect in the rendering phase."}</p>
      </div>

      <section className="section certificate-detail-layout">
        <article className="panel">
          <span className="label">{isZh ? "配置表单" : "Configuration form"}</span>
          <div className="form-grid">
            <label className="field">
              <span>{isZh ? "模板名称" : "Template name"}</span>
              <input defaultValue={template.name} readOnly />
            </label>
            <label className="field">
              <span>{isZh ? "英文名称" : "English name"}</span>
              <input defaultValue={template.nameEn ?? ""} readOnly />
            </label>
            <label className="field">
              <span>{isZh ? "分类" : "Category"}</span>
              <input defaultValue={getCertificateName(params.locale, template.category)} readOnly />
            </label>
            <label className="field">
              <span>{isZh ? "页面尺寸" : "Page size"}</span>
              <input defaultValue="A4 landscape" readOnly />
            </label>
            <label className="field">
              <span>{isZh ? "二维码位置" : "QR position"}</span>
              <input defaultValue="bottom-right" readOnly />
            </label>
            <label className="field">
              <span>{isZh ? "编号格式" : "Number format"}</span>
              <input defaultValue="CV-{opaque-code}" readOnly />
            </label>
          </div>
        </article>

        <article className="certificate-preview-panel">
          <span className="label">Preview</span>
          <h2>{getCertificateName(params.locale, template)}</h2>
          <div className="certificate-holder-name">{isZh ? "持有人姓名" : "Holder Name"}</div>
          <p>{isZh ? "模板预览会在 Phase 2 接入真实渲染服务。" : "Template preview will use the real rendering service in Phase 2."}</p>
          <div className="certificate-signature-row">
            <div><span>{isZh ? "签名" : "Signature"}</span><strong>Signer</strong></div>
            <div><span>{isZh ? "盖章" : "Seal"}</span><strong>Climate Passport</strong></div>
          </div>
        </article>
      </section>
    </>
  );
}
