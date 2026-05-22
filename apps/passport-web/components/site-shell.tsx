import Link from "next/link";
import type { ReactNode } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getDictionary, type Locale } from "@/lib/site-content";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentUser } from "@/lib/server/auth";

export async function SiteShell({ children, locale }: { children: ReactNode; locale: Locale }) {
  noStore();
  const dictionary = getDictionary(locale);
  const user = await getCurrentUser();
  const isAdminUser = user?.role === "ADMIN" || user?.role === "EVENT_MANAGER";

  // Minimal shell: hide nav + footer main content on focused pages
  const pathname = headers().get("x-pathname") ?? "";
  const isMinimal = pathname.includes("/dashboard/summer-school");

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
                <>
                  <Link className="button-outline nav-action" href={`/${locale}/dashboard/summer-school`}>
                    {dictionary.shell.actions.summerSchool}
                  </Link>
                  {isAdminUser ? (
                    <Link className="button-outline nav-action" href={`/${locale}/admin/events`}>
                      {dictionary.shell.actions.admin}
                    </Link>
                  ) : null}
                  <Link className="button-outline nav-action" href={`/${locale}/dashboard`}>
                    {dictionary.shell.actions.dashboard}
                  </Link>
                  <LogoutButton label={dictionary.shell.actions.logout} locale={locale} />
                </>
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
                <span className="brand-mark footer-brand-mark" aria-hidden="true" />
                <div className="footer-brand-name">{dictionary.shell.footer.platformTitle}</div>
              </div>
              <p className="footer-brand-desc">{dictionary.shell.footer.platformText}</p>
            </div>

            <div className="footer-col">
              <h4>{locale === "zh" ? "导航" : "Navigate"}</h4>
              <Link href={`/${locale}`}>{locale === "zh" ? "首页" : "Home"}</Link>
              <Link href={`/${locale}/events`}>{locale === "zh" ? "活动" : "Events"}</Link>
              <Link href={`/${locale}/speakers`}>{locale === "zh" ? "演讲者" : "Speakers"}</Link>
              <Link href={`/${locale}/about`}>{locale === "zh" ? "关于" : "About"}</Link>
            </div>

            <div className="footer-col">
              <h4>{locale === "zh" ? "信息" : "Info"}</h4>
              <Link href={`/${locale}/privacy`}>{locale === "zh" ? "隐私政策" : "Privacy Policy"}</Link>
              <Link href={`/${locale}/terms`}>{locale === "zh" ? "服务条款" : "Terms of Service"}</Link>
              <Link href={`/${locale}/faq`}>{locale === "zh" ? "常见问题" : "FAQ"}</Link>
              <Link href={`/${locale}/contact`}>{locale === "zh" ? "联系我们" : "Contact"}</Link>
            </div>

            <div className="footer-col">
              <h4>{locale === "zh" ? "联系" : "Contact"}</h4>
              <p>hello@climatepass.org</p>
              <p>{locale === "zh" ? "中国上海" : "Shanghai, China"}</p>
            </div>
          </div>
        )}

        <div className="footer-bottom-bar">
          <div className="footer-bottom-bar-inner">
            <p className="footer-disclaimer" style={{ maxWidth: "unset" }}>
              {locale === "zh"
                ? "Climate Passport 致力于为气候时代的学习、凭证和行动记录构建可信任的身份基础设施。本页面展示的所有用户数据、项目指标均为说明性内容。"
                : "Climate Passport is designed as a trust layer for climate-era learning, credentials and action records. All names, programme data and metrics shown are illustrative for demonstration purposes."}
            </p>
            <div className="footer-legal">
              <Link href={`/${locale}/terms`}>{locale === "zh" ? "服务条款" : "Terms"}</Link>
              <Link href={`/${locale}/privacy`}>{locale === "zh" ? "隐私政策" : "Privacy"}</Link>
              <span>{dictionary.shell.footer.rights}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}