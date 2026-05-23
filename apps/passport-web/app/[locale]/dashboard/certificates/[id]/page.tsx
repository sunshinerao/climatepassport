import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import {
  CertificateDownloadButton,
  CertificateVisibilityToggle,
  CopyVerificationLinkButton,
} from "@/components/certificate-actions";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  formatCertificateDate,
  getCertificateName,
  getCertificateStatusLabel,
  getVerificationUrl,
} from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function UserCertificateDetailPage({
  params,
}: {
  params: { locale: Locale; id: string };
}) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/certificates/${params.id}`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";

  const issue = prisma
    ? await prisma.certificateIssue.findFirst({
        where: { id: params.id, userId: user.id },
        include: {
          definition: {
            include: {
              category: true,
              template: true,
            },
          },
          user: { select: { name: true, email: true, climatePassportId: true, title: true } },
          verifications: { orderBy: { verifiedAt: "desc" }, take: 6 },
        },
      })
    : null;

  if (!issue) {
    notFound();
  }

  const certificateName = getCertificateName(params.locale, issue.definition);
  const categoryName = getCertificateName(params.locale, issue.definition.category);
  const verificationUrl = getVerificationUrl(issue.verificationCode);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "证书详情" : "Certificate Detail"}</span>
          <h1>{certificateName}</h1>
        </div>
        <p>
          {isZh
            ? "这里展示证书作为 digital credential 的完整签发、验证与身份信息。"
            : "This page shows the credential identity, issuance, and verification context for this digital credential."}
        </p>
      </div>

      <section className="section certificate-detail-layout">
        <article className="certificate-preview-panel">
          <span className="label">Climate Passport Verified Credential</span>
          <h2>{certificateName}</h2>
          <div className="certificate-holder-name">{issue.user.name}</div>
          <p>
            {isZh
              ? "该证书记录了用户在 Climate Passport 中经过验证的学习、活动、项目或角色贡献。"
              : "This credential records verified learning, participation, project, or role contribution in Climate Passport."}
          </p>
          <div className="certificate-signature-row">
            <div>
              <span>{isZh ? "签发机构" : "Issuer"}</span>
              <strong>Climate Passport</strong>
            </div>
            <div>
              <span>{isZh ? "签名与盖章" : "Signature and seal"}</span>
              <strong>Verified digitally</strong>
            </div>
          </div>
        </article>

        <aside className="panel">
          <span className="label">{isZh ? "证书身份" : "Credential identity"}</span>
          <dl className="certificate-meta-list">
            <div>
              <dt>{isZh ? "持有人" : "Holder"}</dt>
              <dd>{issue.user.name}</dd>
            </div>
            <div>
              <dt>{isZh ? "证书编号" : "Certificate number"}</dt>
              <dd>{issue.verificationCode ?? "—"}</dd>
            </div>
            <div>
              <dt>{isZh ? "类型" : "Type"}</dt>
              <dd>{categoryName}</dd>
            </div>
            <div>
              <dt>{isZh ? "状态" : "Status"}</dt>
              <dd>{getCertificateStatusLabel(params.locale, issue.status)}</dd>
            </div>
            <div>
              <dt>{isZh ? "签发日期" : "Issue date"}</dt>
              <dd>{formatCertificateDate(params.locale, issue.issuedAt ?? issue.createdAt)}</dd>
            </div>
            <div>
              <dt>{isZh ? "关联来源" : "Related source"}</dt>
              <dd>{issue.sourceType ?? (isZh ? "手动签发" : "Manual issue")}</dd>
            </div>
            <div>
              <dt>{isZh ? "能力标签" : "Capability tags"}</dt>
              <dd>{categoryName}, {issue.definition.template.templateType}</dd>
            </div>
          </dl>

          <div className="certificate-qr-box">
            <strong>{isZh ? "二维码验证区" : "QR verification area"}</strong>
            <span>{verificationUrl ?? (isZh ? "该证书尚未生成验证链接" : "No verification link generated yet")}</span>
          </div>

          <div className="button-row">
            {issue.status === "ISSUED" ? <CertificateDownloadButton certificateId={issue.id} label={isZh ? "下载 PDF" : "Download PDF"} /> : null}
            {verificationUrl ? <CopyVerificationLinkButton url={verificationUrl} label={isZh ? "复制验证链接" : "Copy verification link"} /> : null}
            {verificationUrl ? (
              <Link className="button-outline" href={verificationUrl}>
                {isZh ? "打开验证页" : "Open verify page"}
              </Link>
            ) : null}
          </div>
          <div className="certificate-share-row">
            <span>{isZh ? "分享" : "Share"}</span>
            <a href={`mailto:?subject=${encodeURIComponent(certificateName)}&body=${encodeURIComponent(verificationUrl ?? "")}`}>Email</a>
            <a href="https://www.linkedin.com/profile/add" target="_blank" rel="noreferrer">LinkedIn</a>
            <span>WeChat</span>
          </div>
          <CertificateVisibilityToggle
            certificateId={issue.id}
            initialVisible={issue.publicVisible}
            label={isZh ? "加入个人 Climate Passport 公开档案" : "Show on public Climate Passport profile"}
          />
        </aside>
      </section>
    </>
  );
}
