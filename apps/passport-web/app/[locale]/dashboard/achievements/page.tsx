import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

function isMissingTableError(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "P2021",
  );
}

export default async function DashboardAchievementsPage({
  params,
}: {
  params: { locale: Locale };
}) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/achievements`);
  const prisma = getPrismaClient();
  const achievementModel = (prisma as { achievement?: { findMany: (args: unknown) => Promise<unknown[]> } } | null)?.achievement;
  const isZh = params.locale === "zh";

  let achievements: unknown[] = [];
  if (achievementModel) {
    try {
      achievements = await achievementModel.findMany({
        where: { userId: user.id },
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
      });
    } catch (error) {
      if (!isMissingTableError(error)) {
        throw error;
      }
    }
  }

  return (
    <div className="proto-dashboard-page">
      <section className="proto-dashboard-shell">
        <div className="proto-dashboard-main" style={{ gridColumn: "1 / -1" }}>
          <section className="proto-dashboard-panel">
            <div className="proto-dashboard-panel-head">
              <h2>{isZh ? "成就时间线" : "Achievement Timeline"}</h2>
              <Link href={`/${params.locale}/dashboard/badges`}>{isZh ? "查看徽章" : "View badges"}</Link>
            </div>
            <div className="proto-dashboard-timeline">
              {achievements.length > 0 ? (achievements as Array<{ id: string; createdAt: string | Date; name: string; description: string | null; verificationLevel: string }>).map((item) => (
                <article key={item.id}>
                  <div className="proto-dashboard-datebox" aria-hidden="true">
                    <span className="proto-dashboard-datebox-month">{new Date(item.createdAt).toLocaleString(isZh ? "zh-CN" : "en-US", { month: "short" })}</span>
                    <strong className="proto-dashboard-datebox-day">{new Date(item.createdAt).getDate()}</strong>
                  </div>
                  <div className="proto-dashboard-timeline-body">
                    <strong>{item.name}</strong>
                    <p>{item.description || (isZh ? "暂无描述" : "No description")}</p>
                  </div>
                  <span className="proto-dashboard-timeline-status">{item.verificationLevel}</span>
                </article>
              )) : <p className="proto-dashboard-empty">{isZh ? "暂无成就记录。" : "No achievements yet."}</p>}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
