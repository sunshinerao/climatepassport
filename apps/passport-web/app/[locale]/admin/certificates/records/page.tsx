import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { CertificateAdminStatusButton, CopyVerificationLinkButton } from "@/components/certificate-actions";
import { requireRoleAccess } from "@/lib/server/auth";
import {
  formatCertificateDate,
  getCertificateName,
  getCertificateStatusLabel,
  getVerificationUrl,
} from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateRecordsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/records`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";

  const issues = prisma
    ? await prisma.certificateIssue.findMany({
        orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
        include: {
          user: { select: { name: true, email: true } },
          approver: { select: { name: true } },
          definition: { include: { category: true, template: true } },
          verifications: { select: { id: true } },
        },
      })
    : [];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "证书记录" : "Certificate Records"}</span>
          <h1>{isZh ? "已生成证书管理" : "Generated credential records"}</h1>
        </div>
        <p>{isZh ? "查看证书编号、持有人、状态、验证次数，并执行撤销、恢复、下载和复制验证链接等操作。" : "Review certificate numbers, holders, statuses, verification counts, and operational actions."}</p>
      </div>

      <section className="section panel certificate-table-panel">
        <div className="certificate-table">
          <div className="certificate-table-row head">
            <span>{isZh ? "证书编号" : "Certificate no."}</span>
            <span>{isZh ? "证书" : "Certificate"}</span>
            <span>{isZh ? "持有人" : "Holder"}</span>
            <span>{isZh ? "状态" : "Status"}</span>
            <span>{isZh ? "验证" : "Checks"}</span>
            <span>{isZh ? "操作" : "Actions"}</span>
          </div>
          {issues.map((issue) => {
            const verificationUrl = getVerificationUrl(issue.verificationCode);
            return (
              <div className="certificate-table-row" key={issue.id}>
                <span>{issue.verificationCode ?? "—"}</span>
                <span>
                  <strong>{getCertificateName(params.locale, issue.definition)}</strong>
                  <small>{getCertificateName(params.locale, issue.definition.category)} · {formatCertificateDate(params.locale, issue.issuedAt ?? issue.createdAt)}</small>
                </span>
                <span>
                  <strong>{issue.user.name}</strong>
                  <small>{issue.user.email}</small>
                </span>
                <span>{getCertificateStatusLabel(params.locale, issue.status)}</span>
                <span>{issue.verifications.length}</span>
                <span className="certificate-row-actions">
                  <Link className="button-outline" href={`/${params.locale}/dashboard/certificates/${issue.id}`}>
                    {isZh ? "查看" : "View"}
                  </Link>
                  {verificationUrl ? <CopyVerificationLinkButton url={verificationUrl} label={isZh ? "复制链接" : "Copy link"} /> : null}
                  {issue.status === "REVOKED" ? (
                    <CertificateAdminStatusButton certificateId={issue.id} action="restore" label={isZh ? "恢复" : "Restore"} />
                  ) : (
                    <CertificateAdminStatusButton certificateId={issue.id} action="revoke" label={isZh ? "撤销" : "Revoke"} />
                  )}
                  <CertificateAdminStatusButton certificateId={issue.id} action="regenerate" label={isZh ? "重新生成" : "Regenerate"} />
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
