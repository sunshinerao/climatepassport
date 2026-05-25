import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { formatCertificateDate, getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminIssue } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateIssuePage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/issue`);
  const prisma = getPrismaClient();

  const [templates, issues] = prisma
    ? await Promise.all([
        prisma.certificateTemplate.findMany({
          where: { isActive: true },
          orderBy: { updatedAt: "desc" },
          take: 100,
          include: {
            category: {
              select: {
                name: true,
                nameEn: true,
              },
            },
            definitions: {
              where: { isActive: true },
              orderBy: { updatedAt: "desc" },
              take: 1,
              select: {
                name: true,
                nameEn: true,
                approvalMode: true,
              },
            },
          },
        }),
        prisma.certificateIssue.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { name: true, email: true } },
            definition: { include: { category: true } },
            verifications: { select: { id: true } },
          },
        }),
      ])
    : [[], []];

  return (
    <CertificateAdminIssue
      locale={params.locale}
      templates={templates.map((template) => ({
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
        renderConfig: template.renderConfigJson && typeof template.renderConfigJson === "object" && !Array.isArray(template.renderConfigJson)
          ? (template.renderConfigJson as Record<string, unknown>)
          : undefined,
        definition: template.definitions[0]
          ? {
              name: template.definitions[0].name,
              nameEn: template.definitions[0].nameEn,
              approvalMode: template.definitions[0].approvalMode,
            }
          : null,
      }))}
      recentIssues={issues.map((issue) => ({
        id: issue.id,
        certificateNumber: issue.verificationCode ?? issue.id,
        certificateName: getCertificateName(params.locale, issue.definition),
        categoryName: getCertificateName(params.locale, issue.definition.category),
        holderName: issue.user.name,
        holderEmail: issue.user.email,
        templateId: issue.definition.templateId,
        issueDate: formatCertificateDate(params.locale, issue.issuedAt ?? issue.createdAt),
        status: issue.status,
        source: issue.sourceType,
        verificationCount: issue.verifications.length,
        generatedFileUrl: issue.generatedFileUrl,
        generatedFileName: issue.generatedFileName,
        issueVariableValues: issue.variableValuesJson && typeof issue.variableValuesJson === "object" && !Array.isArray(issue.variableValuesJson)
          ? (issue.variableValuesJson as Record<string, unknown>)
          : null,
      }))}
    />
  );
}
