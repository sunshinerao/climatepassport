import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { parseCertificateRenderConfig } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminTemplatesClient } from "@/components/certificate-admin-templates-client";
import type { Locale } from "@/lib/site-content";

type LegacyTemplateCategoryRow = {
  id: string;
  key: string;
  name: string;
  nameEn: string | null;
};

export default async function AdminCertificateTemplatesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/templates`);
  const prisma = getPrismaClient();

  const [templates, categories] = prisma
    ? await Promise.all([
        prisma.certificateTemplate.findMany({
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
          include: {
            category: true,
            definitions: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                name: true,
                nameEn: true,
                approvalMode: true,
                _count: {
                  select: { issues: true },
                },
              },
            },
          },
        }),
        prisma.$queryRaw<LegacyTemplateCategoryRow[]>`
          SELECT id, key, name, "nameEn"
          FROM "certificate_categories"
          WHERE "isActive" = true
          ORDER BY "order" ASC
        `,
      ])
    : [[], [] as LegacyTemplateCategoryRow[]];

  return (
    <CertificateAdminTemplatesClient
      categories={categories}
      locale={params.locale}
      templates={templates.map((template) => {
        const primaryDefinition = template.definitions[0] ?? null;
        const issuedCount = template.definitions.reduce((sum, definition) => sum + definition._count.issues, 0);
        return {
          id: template.id,
          categoryId: template.categoryId,
          name: template.name,
          nameEn: template.nameEn,
          templateType: template.templateType,
          isActive: template.isActive,
          version: template.version,
          updatedAt: template.updatedAt.toISOString(),
          categoryName: template.category.name,
          categoryNameEn: template.category.nameEn,
          issuedCount,
          renderConfig: parseCertificateRenderConfig(template.renderConfigJson),
          definition: primaryDefinition ? {
            name: primaryDefinition.name,
            nameEn: primaryDefinition.nameEn,
            approvalMode: primaryDefinition.approvalMode,
          } : null,
        };
      })}
    />
  );
}
