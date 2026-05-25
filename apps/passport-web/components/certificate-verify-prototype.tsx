"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/site-content";

function t(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

export type VerificationData = {
  status: "valid" | "expired" | "revoked" | "not-found" | "preview" | "invalid";
  certificateName?: string;
  certificateNameEn?: string;
  holderName?: string;
  maskedPassportId?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  certificateNumber?: string;
  credentialType?: string;
  relatedSource?: string;
  verifiedAt?: string;
  competencies?: string[];
  revocationDate?: string;
  verificationMessage?: string;
  accessLevel?: "PUBLIC" | "HOLDER" | "STAFF";
  isAuthenticatedViewer?: boolean;
  verificationCount?: number;
  queryCount?: number;
  holderEmail?: string;
  internalStatus?: string;
  verificationMode?: string;
  publicVerifyEnabled?: boolean;
};

export function CertificateVerifyPage({
  locale,
  data,
}: {
  locale: Locale;
  data: VerificationData;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const statusConfig = {
    valid: {
      icon: "✓",
      title: t(locale, "证书有效", "Certificate Valid"),
      subtitle: t(
        locale,
        "此凭证由 Climate Passport 签发，可独立验证其真实性。",
        "This credential was issued by Climate Passport and can be independently verified."
      ),
      className: "cpv-state-valid",
    },
    expired: {
      icon: "⏱",
      title: t(locale, "证书已过期", "Certificate Expired"),
      subtitle: t(
        locale,
        "此凭证曾由 Climate Passport 签发，但已超过有效期。",
        "This credential was issued by Climate Passport but has passed its validity period."
      ),
      className: "cpv-state-expired",
    },
    revoked: {
      icon: "✕",
      title: t(locale, "证书已撤销", "Certificate Revoked"),
      subtitle: t(
        locale,
        "此凭证已被签发机构撤销，不再有效。",
        "This credential has been revoked by the issuing authority and is no longer valid."
      ),
      className: "cpv-state-revoked",
    },
    "not-found": {
      icon: "?",
      title: t(locale, "未找到证书", "Certificate Not Found"),
      subtitle: t(
        locale,
        "该验证链接无效，或证书不存在于 Climate Passport 系统中。",
        "The verification link is invalid or the certificate does not exist in Climate Passport."
      ),
      className: "cpv-state-notfound",
    },
    invalid: {
      icon: "!",
      title: t(locale, "证书不可公开验证", "Certificate Not Publicly Verifiable"),
      subtitle: t(
        locale,
        "该凭证当前不满足公开验证策略，或不处于可公开验证状态。",
        "This credential does not currently satisfy public verification policy, or is not in a publicly verifiable state."
      ),
      className: "cpv-state-expired",
    },
    preview: {
      icon: "i",
      title: t(locale, "预览证书二维码", "Preview Certificate QR"),
      subtitle: t(
        locale,
        "该二维码来自证书模板预览，仅用于排版与样式确认，不代表正式签发结果。",
        "This QR code comes from a certificate template preview. It is for layout review only and does not represent an officially issued credential."
      ),
      className: "cpv-state-preview",
    },
  };

  const config = statusConfig[data.status];

  return (
    <div className="cpv">
      {/* Result Banner */}
      <div className={`cpv-banner ${config.className}`}>
        <div className="cpv-icon-badge">
          <span>{config.icon}</span>
        </div>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
        <div className="cpv-verified-time">
          {t(locale, "验证时间", "Verified at")}: {data.verifiedAt ?? new Date().toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
        </div>
        {data.verificationMessage ? <p className="cpv-notice-detail">{data.verificationMessage}</p> : null}
      </div>

      {/* Expiry Notice */}
      {data.status === "expired" && data.expiryDate && (
        <div className="cpv-notice cpv-notice-expired">
          <span className="cpv-notice-icon">⏱</span>
          <div>
            <strong>{t(locale, "证书已于以下日期过期", "Certificate expired on")}</strong>
            <p>{data.expiryDate}</p>
            <p className="cpv-notice-detail">
              {t(
                locale,
                "此证书的有效期已结束。持有人可能需要重新认证以获取更新的凭证。",
                "The validity period of this certificate has ended. The holder may need to recertify to obtain an updated credential."
              )}
            </p>
          </div>
        </div>
      )}

      {/* Revocation Notice */}
      {data.status === "revoked" && (
        <div className="cpv-notice cpv-notice-revoked">
          <span className="cpv-notice-icon">✕</span>
          <div>
            <strong>{t(locale, "证书已被撤销", "Certificate has been revoked")}</strong>
            {data.revocationDate && <p>{t(locale, "撤销日期", "Revocation date")}: {data.revocationDate}</p>}
            <p className="cpv-notice-detail">
              {t(
                locale,
                "此凭证已被管理机构撤销。如有疑问，请联系签发方。",
                "This credential has been revoked by the issuing authority. Contact the issuer for details."
              )}
            </p>
          </div>
        </div>
      )}

      {/* Certificate Summary Card */}
      {data.status !== "not-found" && (
        <div className={`cpv-summary-card ${data.status === "revoked" ? "is-muted" : ""}`}>
          <div className="cpv-summary-header">
            <div>
              <span className="cpv-type-label">{data.credentialType ?? t(locale, "证书", "Certificate")}</span>
              <h2>{data.certificateName ?? t(locale, "未命名证书", "Unnamed Certificate")}</h2>
            </div>
            <span className={`cpv-status-pill ${config.className}`}>
              <span className="cpv-dot" />
              {config.title}
            </span>
          </div>

          <dl className="cpv-detail-grid">
            {data.holderName && (
              <div>
                <dt>{t(locale, "持有人", "Holder")}</dt>
                <dd>{data.holderName}</dd>
              </div>
            )}
            {data.maskedPassportId && (
              <div>
                <dt>{t(locale, "Passport ID", "Passport ID")}</dt>
                <dd className="cpv-mono">{data.maskedPassportId}</dd>
              </div>
            )}
            <div>
              <dt>{t(locale, "签发机构", "Issuer")}</dt>
              <dd>{data.issuer ?? "Climate Passport"}</dd>
            </div>
            {data.issueDate && (
              <div>
                <dt>{t(locale, "签发日期", "Issue Date")}</dt>
                <dd>{data.issueDate}</dd>
              </div>
            )}
            {data.expiryDate && (
              <div>
                <dt>{t(locale, "有效期至", "Valid Until")}</dt>
                <dd>{data.expiryDate}</dd>
              </div>
            )}
            {data.certificateNumber && (
              <div>
                <dt>{t(locale, "证书编号", "Certificate Number")}</dt>
                <dd className="cpv-mono">{data.certificateNumber}</dd>
              </div>
            )}
            {data.credentialType && (
              <div>
                <dt>{t(locale, "证书类型", "Credential Type")}</dt>
                <dd>{data.credentialTypeEn ?? data.credentialType}</dd>
              </div>
            )}
            {data.relatedSource && (
              <div>
                <dt>{t(locale, "关联来源", "Related Source")}</dt>
                <dd>{data.relatedSource}</dd>
              </div>
            )}
          </dl>

          {/* Competency Tags */}
          {data.competencies && data.competencies.length > 0 && (
            <div className="cpv-competencies">
              <span className="cpv-section-label">{t(locale, "能力标签", "Competency Areas")}</span>
              <div className="cpv-tags">
                {data.competencies.map((tag) => (
                  <span className={`cpv-tag ${config.className}`} key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(data.isAuthenticatedViewer || data.accessLevel === "STAFF") && data.status !== "not-found" && (
        <div className="cpv-verification-details">
          <h3>{t(locale, "登录视图信息", "Signed-in Verification Context")}</h3>
          <div className="cpv-verify-items">
            <div className="cpv-verify-item">
              <dt>{t(locale, "访问级别", "Access Level")}</dt>
              <dd>{data.accessLevel ?? "PUBLIC"}</dd>
            </div>
            {typeof data.verificationCount === "number" && (
              <div className="cpv-verify-item">
                <dt>{t(locale, "累计验证次数", "Verification Count")}</dt>
                <dd>{data.verificationCount}</dd>
              </div>
            )}
            {typeof data.queryCount === "number" && (
              <div className="cpv-verify-item">
                <dt>{t(locale, "累计查询次数", "Query Count")}</dt>
                <dd>{data.queryCount}</dd>
              </div>
            )}
            {data.internalStatus && (
              <div className="cpv-verify-item">
                <dt>{t(locale, "内部状态", "Internal Status")}</dt>
                <dd>{data.internalStatus}</dd>
              </div>
            )}
            {data.verificationMode && (
              <div className="cpv-verify-item">
                <dt>{t(locale, "验证模式", "Verification Mode")}</dt>
                <dd>{data.verificationMode}</dd>
              </div>
            )}
            {typeof data.publicVerifyEnabled === "boolean" && (
              <div className="cpv-verify-item">
                <dt>{t(locale, "分类公开验证开关", "Category Public Verify")}</dt>
                <dd>{data.publicVerifyEnabled ? t(locale, "开启", "Enabled") : t(locale, "关闭", "Disabled")}</dd>
              </div>
            )}
            {data.accessLevel === "STAFF" && data.holderEmail && (
              <div className="cpv-verify-item">
                <dt>{t(locale, "持有人邮箱", "Holder Email")}</dt>
                <dd className="cpv-mono">{data.holderEmail}</dd>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Not Found Suggestions */}
      {data.status === "not-found" && (
        <div className="cpv-suggestions">
          <h2>{t(locale, "可能的原因", "Possible Reasons")}</h2>
          <ul>
            <li>
              <span>🔗</span>
              <span>{t(locale, "验证链接可能不完整或已被修改", "The verification link may be incomplete or modified")}</span>
            </li>
            <li>
              <span>📋</span>
              <span>{t(locale, "证书编号输入错误", "The certificate number was entered incorrectly")}</span>
            </li>
            <li>
              <span>🕐</span>
              <span>{t(locale, "证书可能尚未签发完成", "The certificate may not yet have been fully issued")}</span>
            </li>
            <li>
              <span>🗑️</span>
              <span>{t(locale, "证书记录可能已被移除", "The certificate record may have been removed")}</span>
            </li>
          </ul>
        </div>
      )}

      {/* Verification Details */}
      {data.status !== "not-found" && data.certificateNumber && (
        <div className="cpv-verification-details">
          <h3>{t(locale, "验证详情", "Verification Details")}</h3>
          <div className="cpv-verify-items">
            <div className="cpv-verify-item">
              <dt>{t(locale, "验证码", "Verification Code")}</dt>
              <dd>
                <code className="cpv-mono">{data.certificateNumber}</code>
                <button
                  className="cpv-copy-btn"
                  onClick={() => handleCopy(data.certificateNumber!)}
                  type="button"
                >
                  {copied ? "✓" : t(locale, "复制", "Copy")}
                </button>
              </dd>
            </div>
            <div className="cpv-verify-item">
              <dt>{t(locale, "验证方式", "Verification Method")}</dt>
              <dd>{t(locale, "Climate Passport 服务器验证", "Climate Passport Server Verification")}</dd>
            </div>
            <div className="cpv-verify-item">
              <dt>{t(locale, "完整性", "Integrity")}</dt>
              <dd>
                <span className={`cpv-integrity-badge ${config.className}`}>
                  {data.status === "valid"
                    ? t(locale, "完整 · 未被篡改", "Intact · No tampering detected")
                    : data.status === "expired"
                      ? t(locale, "完整 · 已过期", "Intact · Expired")
                      : t(locale, "已撤销", "Revoked")}
                </span>
              </dd>
            </div>
          </div>
        </div>
      )}

      {/* Trust Badge */}
      <div className="cpv-trust">
        <div className="cpv-trust-badge">
          <strong>Climate Passport</strong>
          <p>
            {t(
              locale,
              "Climate Passport 是由上海气候周 (SHCW) 运营的可信数字证书平台，为气候行动参与者提供可独立验证的能力记录。",
              "Climate Passport is a trusted digital credential platform operated by Shanghai Climate Week (SHCW), providing independently verifiable capability records for climate action participants."
            )}
          </p>
          <Link className="cpv-trust-link" href={`/${locale}`}>
            {t(locale, "了解更多", "Learn more about Climate Passport")} →
          </Link>
        </div>
      </div>

      {/* Verify Another */}
      <div className="cpv-verify-another">
        <h3>{t(locale, "验证其他证书", "Verify Another Certificate")}</h3>
        <form action={`/${locale}/verify`} className="cpv-verify-form" method="get">
          <input
            name="code"
            placeholder={t(locale, "输入验证码...", "Enter verification code...")}
            type="text"
          />
          <button type="submit">{t(locale, "验证", "Verify")}</button>
        </form>
      </div>
    </div>
  );
}
