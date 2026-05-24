import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { formatCertificateDate, getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminRecords } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateRecordsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/records`);
  const prisma = getPrismaClient();
  const issues = prisma
    ? await prisma.certificateIssue.findMany({
        orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
        include: {
          user: { select: { name: true, email: true } },
          definition: { include: { category: true, template: true } },
          verifications: { select: { id: true } },
        },
      })
    : [];

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
      }))}
    />
  );
}
