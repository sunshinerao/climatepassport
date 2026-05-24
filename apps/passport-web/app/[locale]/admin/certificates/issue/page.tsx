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
        prisma.certificateTemplate.findMany({ where: { isActive: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
        prisma.certificateIssue.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { name: true, email: true } }, definition: { include: { category: true } }, verifications: { select: { id: true } } },
        }),
      ])
    : [[], []];

  return (
    <CertificateAdminIssue
      locale={params.locale}
      templates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        nameEn: template.nameEn,
        templateType: template.templateType,
        isActive: template.isActive,
        version: template.version,
      }))}
      recentIssues={issues.map((issue) => ({
        id: issue.id,
        certificateNumber: issue.verificationCode ?? issue.id,
        certificateName: getCertificateName(params.locale, issue.definition),
        categoryName: getCertificateName(params.locale, issue.definition.category),
        holderName: issue.user.name,
        holderEmail: issue.user.email,
        issueDate: formatCertificateDate(params.locale, issue.issuedAt ?? issue.createdAt),
        status: issue.status,
        source: issue.sourceType,
        verificationCount: issue.verifications.length,
      }))}
    />
  );
}
