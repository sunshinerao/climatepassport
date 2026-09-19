import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { formatCertificateDate, getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminRecords } from "@/components/certificate-admin-prototype";
import { buildCertificateRecordsAggregateWhere, buildCertificateRecordsWhere, certificateRecordsOrderBy, parseCertificateRecordsQuery } from "@/lib/server/certificate-records";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateRecordsPage({ params, searchParams }: { params: { locale: Locale }; searchParams: Record<string, string | string[] | undefined> }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/records`);
  const prisma = getPrismaClient();
  const query = parseCertificateRecordsQuery(searchParams);
  const where = buildCertificateRecordsWhere(query);
  const aggregateWhere = buildCertificateRecordsAggregateWhere(query);
  const [issues, total, statusGroups, categories] = prisma
    ? await Promise.all([
      prisma.certificateIssue.findMany({
        where, orderBy: certificateRecordsOrderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize,
        include: {
          user: { select: { name: true, email: true } },
          definition: { include: { category: true, template: true } },
          verifications: { select: { id: true } },
        },
      }),
      prisma.certificateIssue.count({ where }),
      prisma.certificateIssue.groupBy({ by: ["status"], where: aggregateWhere, _count: { _all: true } }),
      prisma.certificateCategory.findMany({ where: { isActive: true }, orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true, name: true, nameEn: true } }),
    ])
    : [[], 0, [], []] as const;
  const summary = statusGroups.reduce((result, group) => {
    if (group.status === "REVOKED") result.revoked += group._count._all;
    else result.active += group._count._all;
    return result;
  }, { active: 0, revoked: 0 });

  return (
    <CertificateAdminRecords
      locale={params.locale}
      issues={issues.map((issue) => ({
        id: issue.id,
        certificateNumber: issue.verificationCode ?? issue.id,
        certificateName: getCertificateName(params.locale, issue.definition),
        categoryName: getCertificateName(params.locale, issue.definition.category),
        holderName: issue.user.name,
        holderEmail: issue.user.email,
        issueDate: formatCertificateDate(params.locale, issue.issuedAt ?? issue.createdAt),
        status: issue.status,
        source: issue.sourceType ?? "Manual",
        verificationCount: issue.verifications.length,
        generatedFileUrl: issue.generatedFileUrl,
        generatedFileName: issue.generatedFileName,
      }))}
      pagination={{ page: query.page, pageSize: query.pageSize, total }}
      summary={summary}
      query={query}
      categories={categories.map((category) => ({ id: category.id, name: getCertificateName(params.locale, category) }))}
    />
  );
}
