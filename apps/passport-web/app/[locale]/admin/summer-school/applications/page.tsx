import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";
import SummerSchoolApplicationsClient from "@/components/admin/summer-school-applications-client";

export default async function SummerSchoolApplicationsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const locale = params.locale;
  const isZh = locale === "zh";

  await requireRoleAccess(locale, ["ADMIN"], `/${locale}/admin`);

  return (
    <>
      <header className="proto-admin-main-head">
        <h2>{isZh ? "夏校申请记录" : "Summer School Applications"}</h2>
        <p>
          {isZh
            ? "查看所有夏校申请，勾选后批量下载为独立 PDF（浏览器打印 → 另存为 PDF）。"
            : "View all summer school applications. Select records and download as individual printable PDFs."}
        </p>
      </header>

      <SummerSchoolApplicationsClient locale={locale} />
    </>
  );
}
