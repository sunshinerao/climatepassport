import { maskPassportId } from "@climate-passport/passport-core";
import type { CertificateIssueStatus } from "@prisma/client";
import type { Locale } from "@/lib/site-content";
import { getPrismaClient } from "@/lib/server/prisma";

export function formatCertificateDate(locale: Locale, value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function getCertificateName(locale: Locale, item: { name: string; nameEn?: string | null }) {
  return locale === "zh" ? item.name : item.nameEn ?? item.name;
}

export function getCertificateStatusLabel(locale: Locale, status: CertificateIssueStatus | string) {
  const labels: Record<string, { en: string; zh: string }> = {
    DRAFT: { en: "Draft", zh: "草稿" },
    PENDING_APPROVAL: { en: "Pending review", zh: "待审核" },
    APPROVED: { en: "Approved", zh: "已通过" },
    GENERATED: { en: "Generated", zh: "已生成" },
    ISSUED: { en: "Issued", zh: "已签发" },
    REVOKED: { en: "Revoked", zh: "已撤销" },
  };

  return labels[status]?.[locale === "zh" ? "zh" : "en"] ?? status;
}

export function getVerificationUrl(code: string | null | undefined) {
  return code ? `/verify/certificate/${encodeURIComponent(code)}` : null;
}

export function renderCertificateHtml(input: {
  holderName: string;
  certificateName: string;
  categoryName: string;
  issueDate: string;
  certificateNumber: string;
  issuerName?: string;
}) {
  const issuerName = input.issuerName ?? "Climate Passport";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${input.certificateName}</title>
  <style>
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: #12382f; background: #f6f9f6; }
    .certificate { width: 1120px; min-height: 780px; margin: 32px auto; padding: 72px; background: #fff; border: 1px solid #bfd0c8; box-shadow: 0 24px 80px rgba(18,56,47,.12); }
    .kicker { letter-spacing: .18em; text-transform: uppercase; font-size: 13px; color: #60766f; font-weight: 700; }
    h1 { margin: 44px 0 16px; font-size: 54px; line-height: 1.04; font-weight: 650; }
    .holder { margin: 36px 0; font-size: 36px; border-bottom: 1px solid #bfd0c8; padding-bottom: 18px; }
    .body { max-width: 760px; font-size: 20px; line-height: 1.7; color: #36524b; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 72px; }
    .meta div { border-top: 1px solid #dde7e1; padding-top: 12px; font-size: 14px; color: #36524b; }
    .meta strong { display: block; margin-top: 6px; color: #12382f; font-size: 16px; }
    .seal { margin-top: 54px; width: 132px; height: 132px; border: 2px solid #1f5a4e; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 800; text-align: center; color: #1f5a4e; }
  </style>
</head>
<body>
  <main class="certificate">
    <div class="kicker">Climate Passport Verified Credential</div>
    <h1>${input.certificateName}</h1>
    <p class="body">This digital credential certifies the verified participation, learning, role, or capability record represented by this certificate.</p>
    <div class="holder">${input.holderName}</div>
    <div class="meta">
      <div>Category<strong>${input.categoryName}</strong></div>
      <div>Issued by<strong>${issuerName}</strong></div>
      <div>Issue date<strong>${input.issueDate}</strong></div>
      <div>Certificate number<strong>${input.certificateNumber}</strong></div>
      <div>Verification<strong>Use the QR or verification link</strong></div>
      <div>Status<strong>Issued</strong></div>
    </div>
    <div class="seal">CLIMATE<br />PASSPORT</div>
  </main>
</body>
</html>`;
}

export async function getCertificateIssueForPublicVerification(code: string) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return null;
  }

  return prisma.certificateIssue.findUnique({
    where: { verificationCode: code },
    include: {
      user: { select: { name: true, climatePassportId: true } },
      definition: {
        include: {
          category: true,
          template: true,
        },
      },
      verifications: { select: { id: true } },
    },
  });
}

export function serializeCertificateCard(locale: Locale, issue: {
  id: string;
  status: CertificateIssueStatus | string;
  issuedAt: Date | null;
  createdAt: Date;
  verificationCode: string | null;
  downloadCount: number;
  generatedFileUrl?: string | null;
  definition: {
    name: string;
    nameEn?: string | null;
    category: { name: string; nameEn?: string | null };
    template?: { name: string; nameEn?: string | null; templateType?: string } | null;
  };
  verifications?: Array<{ id: string }>;
}) {
  return {
    id: issue.id,
    name: getCertificateName(locale, issue.definition),
    category: getCertificateName(locale, issue.definition.category),
    templateName: issue.definition.template ? getCertificateName(locale, issue.definition.template) : null,
    type: issue.definition.template?.templateType ?? "CUSTOM",
    status: issue.status,
    statusLabel: getCertificateStatusLabel(locale, issue.status),
    issuedAtLabel: formatCertificateDate(locale, issue.issuedAt ?? issue.createdAt),
    certificateNumber: issue.verificationCode ?? "—",
    verificationUrl: getVerificationUrl(issue.verificationCode),
    downloadCount: issue.downloadCount,
    verificationCount: issue.verifications?.length ?? 0,
    hasRenderedFile: Boolean(issue.generatedFileUrl),
  };
}

export function serializePublicHolder(input: { name: string; climatePassportId?: string | null }) {
  return {
    name: input.name,
    maskedPassportId: maskPassportId(input.climatePassportId ?? ""),
  };
}
