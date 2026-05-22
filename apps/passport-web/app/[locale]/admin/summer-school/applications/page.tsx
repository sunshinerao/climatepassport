import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { requireRoleAccess } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";
import SummerSchoolApplicationsClient from "@/components/admin/summer-school-applications-client";

export default async function SummerSchoolApplicationsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const locale = params.locale;
  const isZh = locale === "zh";

  await requireRoleAccess(locale, ["ADMIN", "EVENT_MANAGER"], `/${locale}/admin`);

  return (
    <div className="proto-admin-page">
      <section className="proto-admin-shell">
        <aside className="proto-admin-sidebar">
          <div className="proto-admin-sidebar-head">
            <span>{isZh ? "管理控制台" : "Operations Console"}</span>
            <h1>Admin Workspace</h1>
          </div>
          <nav className="proto-admin-nav" aria-label="Admin navigation">
            <span className="proto-admin-nav-section">{isZh ? "运营" : "Operate"}</span>
            <Link href={`/${locale}/admin`}>
              <span aria-hidden="true">◇</span>
              {isZh ? "控制台总览" : "Dashboard"}
            </Link>
            <Link href={`/${locale}/admin/events`}>
              <span aria-hidden="true">◇</span>
              {isZh ? "活动管理" : "Event management"}
            </Link>
            <Link href={`/${locale}/admin/learning-experiences`}>
              <span aria-hidden="true">◇</span>
              {isZh ? "学习项目" : "Learning experiences"}
            </Link>
            <Link className="is-active" href={`/${locale}/admin/summer-school/applications`}>
              <span aria-hidden="true">◉</span>
              {isZh ? "夏校申请" : "Summer school apps"}
            </Link>
            <Link href={`/${locale}/admin/certificates`}>
              <span aria-hidden="true">◇</span>
              {isZh ? "证书中心" : "Certificate hub"}
            </Link>
            <span className="proto-admin-nav-section">{isZh ? "个人" : "Personal"}</span>
            <Link href={`/${locale}/dashboard`}>
              <span aria-hidden="true">◇</span>
              {isZh ? "返回工作台" : "Return workspace"}
            </Link>
          </nav>
        </aside>

        <div className="proto-admin-main">
          <header className="proto-admin-main-head">
            <h2>{isZh ? "夏校申请记录" : "Summer School Applications"}</h2>
            <p>
              {isZh
                ? "查看所有夏校申请，勾选后批量下载为独立 PDF（浏览器打印 → 另存为 PDF）。"
                : "View all summer school applications. Select records and download as individual printable PDFs."}
            </p>
          </header>

          <SummerSchoolApplicationsClient locale={locale} />
        </div>
      </section>
    </div>
  );
}
