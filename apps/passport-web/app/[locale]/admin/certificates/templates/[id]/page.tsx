import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { CertificateTemplateForm } from "@/components/admin-certificate-config-forms";
import {
  getCertificateName,
  parseCertificateRenderConfig,
  renderCertificateHtml,
} from "@/lib/server/certificate-module";
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
  const categories = prisma
    ? await prisma.certificateCategory.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: { id: true, key: true, name: true, nameEn: true },
      })
    : [];

  if (!template) {
    notFound();
  }

  const renderConfig = parseCertificateRenderConfig(template.renderConfigJson);
  const primaryDefinition = template.definitions[0] ?? null;
  const previewHtml = renderCertificateHtml({
    holderName: isZh ? "证书持有人" : "Credential Holder",
    certificateName: getCertificateName(params.locale, primaryDefinition ?? template),
    categoryName: getCertificateName(params.locale, template.category),
    issueDate: new Date().toISOString().slice(0, 10),
    certificateNumber: "CV-PREVIEW",
    verificationUrl: "/verify/certificate/CV-PREVIEW",
    renderConfig,
  });

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
          <CertificateTemplateForm
            categories={categories}
            initialTemplate={{
              id: template.id,
              categoryId: template.categoryId,
              name: template.name,
              nameEn: template.nameEn,
              templateType: template.templateType,
              isActive: template.isActive,
              renderConfig,
              definition: primaryDefinition
                ? {
                    name: primaryDefinition.name,
                    nameEn: primaryDefinition.nameEn,
                    approvalMode: primaryDefinition.approvalMode,
                  }
                : null,
            }}
            locale={params.locale}
          />
        </article>

        <article className="certificate-preview-panel">
          <span className="label">{isZh ? "无边框预览" : "Borderless preview"}</span>
          <iframe
            className="certificate-preview-frame"
            sandbox="allow-scripts"
            srcDoc={previewHtml}
            title={isZh ? "证书模板预览" : "Certificate template preview"}
          />
        </article>
      </section>
    </>
  );
}
