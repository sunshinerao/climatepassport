import { unstable_noStore as noStore } from "next/cache";
import { AdminAchievementsClient } from "@/components/admin-achievements-client";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminAchievementsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/achievements`);
  const prisma = getPrismaClient();

  const achievements = prisma
    ? await prisma.achievement.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: 200,
        include: { user: { select: { name: true, email: true } } },
      })
    : [];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "成就管理" : "Achievement management"}</span>
          <h1>{params.locale === "zh" ? "成就审核与状态流转" : "Achievement review and status flow"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "审核用户提交成就，控制通过、拒绝和撤销，并联动徽章授予引擎。"
            : "Review user-submitted achievements, control approve/reject/revoke actions, and feed badge awarding logic."}
        </p>
      </div>
      <AdminAchievementsClient initialRows={achievements} locale={params.locale} />
    </>
  );
}
