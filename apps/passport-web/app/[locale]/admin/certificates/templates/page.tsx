import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateTemplateForm } from "@/components/admin-certificate-config-forms";
import { CertificateAdminTemplates } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateTemplatesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/templates`);
  const prisma = getPrismaClient();

  const [templates, categories] = prisma
    ? await Promise.all([
        prisma.certificateTemplate.findMany({
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
          include: { category: true, definitions: { select: { id: true } } },
        }),
        prisma.certificateCategory.findMany({
          where: { isActive: true },
          orderBy: { order: "asc" },
          select: { id: true, key: true, name: true, nameEn: true },
        }),
      ])
    : [[], []];

  return (
    <CertificateAdminTemplates
      locale={params.locale}
      templates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        nameEn: template.nameEn,
        templateType: template.templateType,
        isActive: template.isActive,
        version: template.version,
        categoryName: template.category.name,
        categoryNameEn: template.category.nameEn,
        issuedCount: template.definitions.length,
      }))}
      form={<CertificateTemplateForm categories={categories} locale={params.locale} />}
    />
  );
}
