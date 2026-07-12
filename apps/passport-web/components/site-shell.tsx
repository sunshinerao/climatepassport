import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getDictionary, type Locale } from "@/lib/site-content";
import { UserAccountMenu } from "@/components/user-account-menu";
import { getCurrentUser } from "@/lib/server/auth";
import { getSiteBranding } from "@/lib/server/site-settings";

export async function SiteShell({ children, locale }: { children: ReactNode; locale: Locale }) {
  noStore();
  const dictionary = getDictionary(locale);
  const user = await getCurrentUser();
  const branding = await getSiteBranding(locale);

  const brandTitle = branding?.siteName ?? dictionary.shell.footer.platformTitle;
  const brandTagline = branding?.tagline ?? dictionary.shell.footer.platformText;
  const supportEmail = branding?.supportEmail ?? "contact@climatepass.org";
  const supportLocation = locale === "zh" ? "中国上海" : "Shanghai, China";
  const footerDisclaimer = branding?.copyrightText
    ?? "© 2026 Climate Passport. 保留所有权利。面向气候时代的 AI 驱动可信数字身份基础设施。";

  // Minimal shell: hide nav + footer main content on focused pages
  const pathname = headers().get("x-pathname") ?? "";
  const isMinimal = pathname.includes("/dashboard/summer-school");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand-block" href={`/${locale}`}>
            {branding?.logoColor ? (
              <Image alt={brandTitle} className="brand-logo-image" height={42} src={branding.logoColor} unoptimized width={42} />
            ) : (
              <span className="brand-mark" aria-hidden="true" />
            )}
            <span className="brand-title">{brandTitle}</span>
          </Link>

          {!isMinimal && (
            <nav className="nav nav-desktop" aria-label="Primary">
              {dictionary.shell.nav.map((item) => (
                <Link key={item.href} href={`/${locale}${item.href}`}>
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          {!isMinimal && (
            <details className="mobile-nav" role="navigation">
              <summary aria-label={locale === "zh" ? "打开导航菜单" : "Open navigation menu"}>
                <span className="mobile-nav-icon" aria-hidden="true" />
              </summary>
              <nav className="mobile-nav-panel" aria-label="Mobile primary">
                {dictionary.shell.nav.map((item) => (
                  <Link key={item.href} href={`/${locale}${item.href}`}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </details>
          )}

          <div className="header-actions">
            {!isMinimal && (
              user ? (
                <UserAccountMenu locale={locale} user={user} />
              ) : (
                <>
                  <Link className="button-outline nav-action" href={`/${locale}/auth/login`}>
                    {dictionary.shell.actions.login}
                  </Link>
                  <Link className="button button-amber nav-action" href={`/${locale}/auth/register`}>
                    {dictionary.shell.actions.register}
                  </Link>
                </>
              )
            )}
            <LocaleSwitcher label={dictionary.shell.switchLabel} locale={locale} />
          </div>
        </div>
      </header>

      <main className="page">{children}</main>

      <footer className="site-footer">
        {!isMinimal && (
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="footer-brand-logo">
                {branding?.logoMono || branding?.logoColor ? (
                  <Image
                    alt={brandTitle}
                    className="footer-brand-logo-image"
                    height={28}
                    src={branding?.logoMono ?? branding?.logoColor ?? ""}
                    unoptimized
                    width={28}
                  />
                ) : (
                  <span className="brand-mark footer-brand-mark" aria-hidden="true" />
                )}
                <div className="footer-brand-name">{brandTitle}</div>
              </div>
              <p className="footer-brand-desc">{brandTagline}</p>
            </div>

            <div className="footer-col">
              <h4>{locale === "zh" ? "导航" : "Navigate"}</h4>
              <Link href={`/${locale}`}>{locale === "zh" ? "首页" : "Home"}</Link>
              <Link href={`/${locale}/activities`}>{locale === "zh" ? "活动" : "Activities"}</Link>
              <Link href={`/${locale}/certificates`}>{locale === "zh" ? "证书" : "Certificates"}</Link>
              <Link href={`/${locale}/contact`}>{locale === "zh" ? "合作" : "Partners"}</Link>
              <Link href={`/${locale}/about`}>{locale === "zh" ? "关于我们" : "About Us"}</Link>
            </div>

            <div className="footer-col">
              <h4>{locale === "zh" ? "法律与支持" : "Legal & Support"}</h4>
              <Link href={`/${locale}/privacy`}>{locale === "zh" ? "隐私政策" : "Privacy Policy"}</Link>
              <Link href={`/${locale}/terms`}>{locale === "zh" ? "服务条款" : "Terms of Service"}</Link>
              <Link href={`/${locale}/faq`}>{locale === "zh" ? "常见问题" : "FAQ"}</Link>
              <Link href={`/${locale}/contact`}>{locale === "zh" ? "联系我们" : "Contact Us"}</Link>
            </div>

            <div className="footer-col">
              <h4>{locale === "zh" ? "保持联系" : "Stay Connected"}</h4>
              <p>{supportEmail}</p>
              <p>{supportLocation}</p>
              {branding?.supportWebsite ? <p>{branding.supportWebsite}</p> : null}
            </div>
          </div>
        )}

        <div className="footer-bottom-bar">
          <div className="footer-bottom-bar-inner">
            <p className="footer-disclaimer" style={{ maxWidth: "unset" }}>
              {footerDisclaimer}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
