import Link from "next/link";
import { SummerSchoolForm } from "@/components/summer-school-form";
import type { Locale } from "@/lib/site-content";

type PageProps = {
  searchParams?: {
    lang?: string;
  };
};

export default function SummerSchoolApplyPublicPage({ searchParams }: PageProps) {
  const locale: Locale = searchParams?.lang === "zh" ? "zh" : "en";
  const isZh = locale === "zh";

  return (
    <main className="page">
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "公开申请" : "Open Application"}</span>
          <h1>{isZh ? "GCA × 云谷 2026 可持续夏校" : "GCA × Yungu 2026 Sustainability Summer School"}</h1>
        </div>
        <p>
          {isZh
            ? "这是临时公开申请入口。提交后系统将自动创建或关联 Climate Passport ID，并在正式注册后自动完成账号关联。"
            : "This is a temporary open application entry. After submission, the system auto-creates or links a Climate Passport ID and will bind it to your formal account after registration."}
        </p>
        <div className="button-row top-gap-sm" aria-label={isZh ? "语言切换" : "Language switch"}>
          <Link
            className={locale === "zh" ? "button button-amber" : "button-outline"}
            href="/learning-experience/summer-school-2026/apply?lang=zh"
          >
            中文
          </Link>
          <Link
            className={locale === "en" ? "button button-amber" : "button-outline"}
            href="/learning-experience/summer-school-2026/apply?lang=en"
          >
            EN
          </Link>
        </div>
      </div>

      <SummerSchoolForm locale={locale} />
    </main>
  );
}
