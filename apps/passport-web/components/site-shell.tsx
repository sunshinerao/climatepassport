import Link from "next/link";
import type { ReactNode } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getDictionary, type Locale } from "@/lib/site-content";
import { UserAccountMenu } from "@/components/user-account-menu";
import { getCurrentUser } from "@/lib/server/auth";

export async function SiteShell({ children, locale }: { children: ReactNode; locale: Locale }) {
  noStore();
  const dictionary = getDictionary(locale);
  const user = await getCurrentUser();

  // Minimal shell: hide nav + footer main content on focused pages
  const pathname = headers().get("x-pathname") ?? "";
  const isMinimal = pathname.includes("/dashboard/summer-school");
  const normalizedPathname = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isLocaleHome = normalizedPathname === `/${locale}`;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand-block" href={`/${locale}`}>
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-title">{dictionary.shell.footer.platformTitle}</span>
          </Link>

          {!isMinimal && (
            <nav className="nav" aria-label="Primary">
              {dictionary.shell.nav.map((item) => (
                <Link key={item.href} href={`/${locale}${item.href}`}>
                  {item.label}
                </Link>
              ))}
            </nav>
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

      <main className={isLocaleHome ? "page page-home" : "page"}>{children}</main>

      <footer className="site-footer">
        {!isMinimal && (
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="footer-brand-logo">
                <span className="brand-mark footer-brand-mark" aria-hidden="true" />
                <div className="footer-brand-name">{dictionary.shell.footer.platformTitle}</div>
              </div>
              <p className="footer-brand-desc">{dictionary.shell.footer.platformText}</p>
            </div>

            <div className="footer-col">
              <h4>{locale === "zh" ? "导航" : "Navigate"}</h4>
              <Link href={`/${locale}`}>{locale === "zh" ? "首页" : "Home"}</Link>
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
              <p>contact@climatepass.org</p>
              <p>{locale === "zh" ? "中国上海" : "Shanghai, China"}</p>
            </div>
          </div>
        )}

        <div className="footer-bottom-bar">
          <div className="footer-bottom-bar-inner">
            <p className="footer-disclaimer" style={{ maxWidth: "unset" }}>
              © 2026 Climate Passport. 保留所有权利。面向气候时代的可信数字身份基础设施。
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
