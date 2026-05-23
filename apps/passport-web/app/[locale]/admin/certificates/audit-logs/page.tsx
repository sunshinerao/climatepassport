import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { formatCertificateDate, getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateAuditLogsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/audit-logs`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";

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
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "验证与审计日志" : "Verification & Audit Logs"}</span>
          <h1>{isZh ? "证书可信操作轨迹" : "Certificate trust operations"}</h1>
        </div>
        <p>{isZh ? "记录公开验证、后台操作、撤销、恢复、重新生成等行为，支撑合规与可信性。" : "Track public verification, admin operations, revoke, restore, and regeneration for trust and compliance."}</p>
      </div>

      <section className="section card-grid compact-grid">
        <article className="data-card"><span className="status-badge">{verifications.length}</span><h3>{isZh ? "验证记录" : "Verification records"}</h3><p>{isZh ? "最近公开或内部验证" : "Recent public or internal verification"}</p></article>
        <article className="data-card"><span className="status-badge">{auditLogs.length}</span><h3>{isZh ? "操作记录" : "Operation logs"}</h3><p>{isZh ? "证书相关后台操作" : "Certificate-related admin operations"}</p></article>
      </section>

      <section className="section certificate-detail-layout">
        <article className="panel certificate-table-panel">
          <span className="label">{isZh ? "验证日志" : "Verification logs"}</span>
          <div className="certificate-log-list">
            {verifications.map((log) => (
              <div key={log.id}>
                <strong>{getCertificateName(params.locale, log.certificateIssue.definition)}</strong>
                <span>{log.result} · {log.verificationChannel}</span>
                <small>{log.certificateIssue.user.name} · {formatCertificateDate(params.locale, log.verifiedAt)}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="panel certificate-table-panel">
          <span className="label">{isZh ? "后台审计" : "Admin audit"}</span>
          <div className="certificate-log-list">
            {auditLogs.map((log) => (
              <div key={log.id}>
                <strong>{log.action}</strong>
                <span>{log.result} · {log.subjectType}</span>
                <small>{log.actor?.name ?? "System"} · {formatCertificateDate(params.locale, log.createdAt)}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
