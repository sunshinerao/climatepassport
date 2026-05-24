import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { formatCertificateDate, getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminApplications } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateApplicationsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/applications`);
  const prisma = getPrismaClient();
  const pendingIssues = prisma
    ? await prisma.certificateIssue.findMany({
        where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true } },
          definition: { include: { category: true } },
          verifications: { select: { id: true } },
        },
      })
    : [];

  return (
    <CertificateAdminApplications
      locale={params.locale}
      issues={pendingIssues.map((issue) => ({
        id: issue.id,
        certificateNumber: issue.verificationCode ?? issue.id,
        certificateName: getCertificateName(params.locale, issue.definition),
        categoryName: getCertificateName(params.locale, issue.definition.category),
        holderName: issue.user.name,
        holderEmail: issue.user.email,
        issueDate: formatCertificateDate(params.locale, issue.createdAt),
        status: issue.status,
        source: issue.sourceType ?? "Climate Passport",
        verificationCount: issue.verifications.length,
      }))}
    />
  );
}
