import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { formatCertificateDate, getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminDashboard } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificatesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates`);
  const prisma = getPrismaClient();

  const unnamedCertificateLabel = params.locale === "zh" ? "未命名证书" : "Untitled certificate";
  const unnamedCategoryLabel = params.locale === "zh" ? "未分类" : "Uncategorized";
  const unknownHolderLabel = params.locale === "zh" ? "未知持有人" : "Unknown holder";

  const [categories, templates, issues] = prisma
    ? await Promise.all([
        prisma.certificateCategory.findMany({
          orderBy: { order: "asc" },
          include: { _count: { select: { templates: true, definitions: true } } },
        }),
        prisma.certificateTemplate.findMany({
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
          take: 60,
        }),
        prisma.certificateIssue.findMany({
          orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
          take: 100,
          include: {
            user: { select: { name: true, email: true } },
            definition: { include: { category: true } },
            verifications: { select: { id: true } },
          },
        }),
      ])
    : [[], [], []];

  return (
    <CertificateAdminDashboard
      locale={params.locale}
      categories={categories.map((category) => ({
        id: category.id,
        key: category.key,
        name: category.name,
        nameEn: category.nameEn,
        description: category.description,
        isActive: category.isActive,
        templateCount: category._count.templates,
        definitionCount: category._count.definitions,
      }))}
      templates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        nameEn: template.nameEn,
        templateType: template.templateType,
        isActive: template.isActive,
        version: template.version,
      }))}
      issues={issues.map((issue) => ({
        id: issue.id,
        certificateNumber: issue.verificationCode ?? issue.id,
        certificateName: issue.definition ? getCertificateName(params.locale, issue.definition) : unnamedCertificateLabel,
        categoryName: issue.definition?.category ? getCertificateName(params.locale, issue.definition.category) : unnamedCategoryLabel,
        holderName: issue.user.name ?? issue.user.email ?? unknownHolderLabel,
        holderEmail: issue.user.email,
        issueDate: formatCertificateDate(params.locale, issue.issuedAt ?? issue.createdAt),
        status: issue.status,
        source: issue.sourceType,
        verificationCount: issue.verifications.length,
      }))}
    />
  );
}
