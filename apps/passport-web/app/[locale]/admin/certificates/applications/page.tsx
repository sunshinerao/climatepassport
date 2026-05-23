import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { formatCertificateDate, getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateApplicationsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/applications`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";
  const pendingIssues = prisma
    ? await prisma.certificateIssue.findMany({
        where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true, climatePassportId: true } },
          definition: { include: { category: true } },
        },
      })
    : [];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "申请审核" : "Application Review"}</span>
          <h1>{isZh ? "用户证书申请与待审记录" : "User certificate applications"}</h1>
        </div>
        <p>{isZh ? "当前用待审核证书记录承载第一版审核队列；独立申请表、附件和补充材料流程将在数据模型扩展后接入。" : "The first review queue is backed by pending certificate issues; application attachments and material requests come with the dedicated model."}</p>
      </div>

      <section className="section panel certificate-table-panel">
        <div className="certificate-table">
          <div className="certificate-table-row head">
            <span>{isZh ? "申请人" : "Applicant"}</span>
            <span>{isZh ? "类型" : "Type"}</span>
            <span>{isZh ? "项目" : "Project"}</span>
            <span>{isZh ? "状态" : "Status"}</span>
            <span>{isZh ? "时间" : "Submitted"}</span>
            <span>{isZh ? "审核操作" : "Review actions"}</span>
          </div>
          {pendingIssues.length === 0 ? (
            <div className="certificate-table-row">
              <span>{isZh ? "暂无待审核申请" : "No pending applications"}</span>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : pendingIssues.map((issue) => (
            <div className="certificate-table-row" key={issue.id}>
              <span><strong>{issue.user.name}</strong><small>{issue.user.email}</small></span>
              <span>{getCertificateName(params.locale, issue.definition.category)}</span>
              <span>{issue.sourceType ?? (isZh ? "手动申请" : "Manual application")}</span>
              <span>{issue.status}</span>
              <span>{formatCertificateDate(params.locale, issue.createdAt)}</span>
              <span className="certificate-row-actions">
                <button className="button-outline" type="button">{isZh ? "通过并签发" : "Approve and issue"}</button>
                <button className="button-outline" type="button">{isZh ? "拒绝" : "Reject"}</button>
                <button className="button-outline" type="button">{isZh ? "补材料" : "Request material"}</button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
