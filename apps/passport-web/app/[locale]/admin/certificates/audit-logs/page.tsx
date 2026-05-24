import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { formatCertificateDate, getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminAuditLogs } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateAuditLogsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/audit-logs`);
  const prisma = getPrismaClient();

  const [verifications, auditLogs] = prisma
    ? await Promise.all([
        prisma.certificateVerification.findMany({
          orderBy: { verifiedAt: "desc" },
          take: 80,
          include: {
            certificateIssue: {
              include: {
                user: { select: { name: true } },
                definition: { include: { category: true } },
              },
            },
          },
        }),
        prisma.coreAuditLog.findMany({
          where: { OR: [{ action: { startsWith: "certificate." } }, { subjectType: "certificate_issue" }] },
          orderBy: { createdAt: "desc" },
          take: 80,
          include: { actor: { select: { name: true, email: true } } },
        }),
      ])
    : [[], []];

  return (
    <CertificateAdminAuditLogs
      locale={params.locale}
      verifications={verifications.map((log) => ({
        id: log.id,
        time: formatCertificateDate(params.locale, log.verifiedAt),
        primary: getCertificateName(params.locale, log.certificateIssue.definition),
        secondary: log.certificateIssue.user.name,
        result: log.result,
        channel: log.verificationChannel,
        region: "Climate Passport",
      }))}
      auditLogs={auditLogs.map((log) => ({
        id: log.id,
        time: formatCertificateDate(params.locale, log.createdAt),
        primary: log.actor?.name ?? "System",
        secondary: log.action,
        result: log.result,
        channel: log.subjectType,
        region: log.subjectId ?? "—",
      }))}
    />
  );
}
