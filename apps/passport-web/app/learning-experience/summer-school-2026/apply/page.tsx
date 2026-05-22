import { SummerSchoolForm } from "@/components/summer-school-form";
import { SummerSchoolLocaleSwitcher } from "@/components/summer-school-locale-switcher";
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
      <div className="ss-public-header">
        <div className="ss-public-header-title">
          <span className="label">{isZh ? "公开申请" : "Open Application"}</span>
          <h1>{isZh ? "可持续夏校2026" : "Sustainability Summer School 2026"}</h1>
        </div>
      </div>

      <SummerSchoolForm
        locale={locale}
        headerRow={
          <>
            <p className="label ss-main-header-copy">
              {isZh
                ? "请提交您的申请，提交后系统将自动创建Climate Passport ID。"
                : "Please submit your application. A Climate Passport ID will be created automatically after submission."}
            </p>
            <div className="ss-main-header-switcher">
              <SummerSchoolLocaleSwitcher locale={locale} label={isZh ? "语言切换" : "Language switch"} />
            </div>
          </>
        }
      />
    </main>
  );
}
