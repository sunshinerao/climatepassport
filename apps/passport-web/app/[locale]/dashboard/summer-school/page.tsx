import { unstable_noStore as noStore } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { SummerSchoolForm } from "@/components/summer-school-form";
import type { Locale } from "@/lib/site-content";

export default async function SummerSchoolPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/summer-school`);
  const isZh = params.locale === "zh";

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "夏校申请" : "Summer School Application"}</span>
          <h1>{isZh ? "GCA × 云谷 2026 可持续夏校" : "GCA × Yungu 2026 Sustainability Summer School"}</h1>
        </div>
        <p>
          {isZh
            ? "面向高中阶段青年的精英气候教育项目，融合 AI 协作、系统思维与实践行动，助你成为下一代气候领导者。"
            : "An elite climate education program for high school students, combining AI collaboration, systems thinking, and hands-on action to help you become the next generation of climate leaders."}
        </p>
      </div>

      <SummerSchoolForm
        locale={params.locale}
        climatePassportId={user.climatePassportId}
      />
    </>
  );
}
