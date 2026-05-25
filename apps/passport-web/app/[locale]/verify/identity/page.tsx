import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import type { Locale } from "@/lib/site-content";
import { resolveIdentityQrVerification } from "@/lib/server/identity-qr-verification";

function t(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

function formatDate(locale: Locale, value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function maskToken(value?: string | null) {
  if (!value) {
    return "-";
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function maskName(value?: string | null) {
  if (!value) {
    return "-";
  }

  if (value.length <= 1) {
    return `${value}*`;
  }

  return `${value.slice(0, 1)}***`;
}

function maskPassportId(value?: string | null) {
  if (!value) {
    return "-";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 3)}***`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export default async function LocalizedIdentityVerifyPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { token?: string; public?: string };
}) {
  noStore();

  const token = searchParams?.token;
  const isPublicMode = searchParams?.public === "1" || searchParams?.public === "true";
  const result = await resolveIdentityQrVerification(token);
  const statusClass = result.ok ? "idv-status-valid" : "idv-status-invalid";
  const statusMeta = result.ok
    ? {
        icon: "✓",
        title: t(params.locale, "身份验证通过", "Identity Verification Passed"),
        subtitle: t(
          params.locale,
          "该 Climate Passport 二维码有效，身份信息已通过服务器校验。",
          "This Climate Passport QR code is valid and identity data has passed server verification.",
        ),
      }
    : {
        icon: "!",
        title: t(params.locale, "身份验证失败", "Identity Verification Failed"),
        subtitle: t(
          params.locale,
          "二维码无效、已过期，或缺少 token。",
          "The QR code is invalid, expired, or missing a token.",
        ),
      };

  const failureHintsByStatus: Record<string, string[]> = {
    MISSING_TOKEN: [
      t(params.locale, "请重新扫码，确保链接完整。", "Please scan again and ensure the link is complete."),
      t(params.locale, "不要手动删改 URL 参数。", "Do not manually edit URL parameters."),
    ],
    INVALID: [
      t(params.locale, "该二维码可能已过期（默认约 2 分钟）。", "This QR code may have expired (default around 2 minutes)."),
      t(params.locale, "该 token 可能已失效或不是 IDENTITY 类型。", "This token may be inactive or not an IDENTITY token."),
    ],
    UNAVAILABLE: [
      t(params.locale, "服务暂不可用，请稍后重试。", "Service is temporarily unavailable, please retry later."),
      t(params.locale, "如持续失败，请联系平台管理员。", "If it keeps failing, please contact the platform administrator."),
    ],
  };

  const failureHints = !result.ok ? (failureHintsByStatus[result.status] ?? []) : [];

  return (
    <div className="idv-page">
      <section className={`idv-card ${statusClass}`}>
        <div className="idv-head">
          <div className="idv-status-mark" aria-hidden="true">{statusMeta.icon}</div>
          <div>
            <span className="idv-badge">{result.ok ? "VALID" : "INVALID"}</span>
            <h1>{statusMeta.title}</h1>
            <p>{statusMeta.subtitle}</p>
          </div>
        </div>

        {result.ok && result.verification ? (
          <>
            <div className="idv-section">
              <h2>{isPublicMode ? t(params.locale, "公开身份摘要", "Public Identity Summary") : t(params.locale, "身份信息", "Identity Details")}</h2>
              <div className="idv-grid">
                <div>
                  <dt>{t(params.locale, "验证状态", "Verification State")}</dt>
                  <dd>{result.status}</dd>
                </div>
                <div>
                  <dt>{t(params.locale, "账户状态", "Account Status")}</dt>
                  <dd>{result.verification.user.status}</dd>
                </div>
                <div>
                  <dt>{t(params.locale, "Climate Passport ID", "Climate Passport ID")}</dt>
                  <dd className="idv-mono">{isPublicMode ? maskPassportId(result.verification.user.climatePassportId) : (result.verification.user.climatePassportId ?? "-")}</dd>
                </div>
                {isPublicMode ? (
                  <div>
                    <dt>{t(params.locale, "姓名（脱敏）", "Name (Masked)")}</dt>
                    <dd>{maskName(result.verification.user.name)}</dd>
                  </div>
                ) : (
                  <>
                    <div>
                      <dt>{t(params.locale, "姓名", "Name")}</dt>
                      <dd>{result.verification.user.name}</dd>
                    </div>
                    <div>
                      <dt>{t(params.locale, "角色", "Role")}</dt>
                      <dd>{result.verification.user.role ?? "-"}</dd>
                    </div>
                  </>
                )}
              </div>
              {isPublicMode ? (
                <p className="idv-privacy-note">
                  {t(
                    params.locale,
                    "这是公开验证视图，仅展示最小必要信息。",
                    "This is a public verification view showing only minimum necessary information.",
                  )}
                </p>
              ) : null}
            </div>

            <div className="idv-section idv-audit-section">
              <h2>{t(params.locale, "核验摘要", "Verification Summary")}</h2>
              <div className="idv-grid">
                <div>
                  <dt>{t(params.locale, "二维码签发时间", "QR Issued At")}</dt>
                  <dd>{formatDate(params.locale, result.verification.issuedAt)}</dd>
                </div>
                <div>
                  <dt>{t(params.locale, "二维码过期时间", "QR Expires At")}</dt>
                  <dd>{formatDate(params.locale, result.verification.expiresAt)}</dd>
                </div>
                <div>
                  <dt>{t(params.locale, "校验状态", "Verification Status")}</dt>
                  <dd>{result.status}</dd>
                </div>
                <div>
                  <dt>{t(params.locale, "Token 摘要", "Token Snapshot")}</dt>
                  <dd className="idv-mono">{maskToken(token ?? null)}</dd>
                </div>
                <div>
                  <dt>{t(params.locale, "校验通道", "Verification Channel")}</dt>
                  <dd className="idv-mono">GET /api/qr/identity</dd>
                </div>
                <div>
                  <dt>{t(params.locale, "二维码类型", "QR Type")}</dt>
                  <dd>{result.verification.type}</dd>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="idv-error-box">
            <strong>{t(params.locale, "错误信息", "Error")}</strong>
            <p>{result.error ?? t(params.locale, "未知错误", "Unknown error")}</p>
            {failureHints.length > 0 ? (
              <ul className="idv-hints">
                {failureHints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <div className="idv-error-meta">
              <span>{t(params.locale, "状态码", "Status")}: {result.status}</span>
              <span className="idv-mono">{t(params.locale, "Token 摘要", "Token Snapshot")}: {maskToken(token ?? null)}</span>
            </div>
          </div>
        )}

        <div className="idv-actions">
          <Link className="button" href={`/${params.locale}`}>
            {t(params.locale, "返回首页", "Back to Home")}
          </Link>
          <Link className="button-outline" href={`/${params.locale}/dashboard/climate-passport`}>
            {t(params.locale, "返回 Climate Passport", "Back to Climate Passport")}
          </Link>
        </div>
      </section>
    </div>
  );
}
