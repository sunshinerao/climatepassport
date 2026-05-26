import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ensureMvpBadgeDefinitions } from "@/lib/server/achievement-badge";
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

export default async function DashboardBadgesPage({
  params,
}: {
  params: { locale: Locale };
}) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/badges`);
  const prisma = getPrismaClient();
  const badgeDefinitionModel = (prisma as { badgeDefinition?: { findMany: (args: unknown) => Promise<unknown[]> } } | null)?.badgeDefinition;
  const badgeAwardModel = (prisma as { badgeAward?: { findMany: (args: unknown) => Promise<unknown[]> } } | null)?.badgeAward;
  const isZh = params.locale === "zh";

  if (prisma && badgeDefinitionModel) {
    try {
      await ensureMvpBadgeDefinitions();
    } catch (error) {
      if (!isMissingTableError(error)) {
        throw error;
      }
    }
  }

  let definitions: unknown[] = [];
  let awards: unknown[] = [];

  if (badgeDefinitionModel && badgeAwardModel) {
    try {
      [definitions, awards] = await Promise.all([
        badgeDefinitionModel.findMany({
          where: { isActive: true },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          take: 100,
        }),
        badgeAwardModel.findMany({
          where: { userId: user.id, status: "ACTIVE" },
          select: { badgeDefinitionId: true },
        }),
      ]);
    } catch (error) {
      if (!isMissingTableError(error)) {
        throw error;
      }
    }
  }

  const owned = new Set((awards as Array<{ badgeDefinitionId: string }>).map((item) => item.badgeDefinitionId));

  return (
    <div className="proto-dashboard-page">
      <section className="proto-dashboard-shell">
        <div className="proto-dashboard-main" style={{ gridColumn: "1 / -1" }}>
          <section className="proto-dashboard-panel">
            <div className="proto-dashboard-panel-head">
              <h2>{isZh ? "徽章墙" : "Badge Wall"}</h2>
              <Link href={`/${params.locale}/dashboard/achievements`}>{isZh ? "查看成就" : "View achievements"}</Link>
            </div>
            <div className="proto-dashboard-badges">
              {definitions.length > 0 ? (definitions as Array<{ id: string; name: string; nameZh: string | null; description: string | null; descriptionZh: string | null; verificationGrade: string }>).map((badge) => {
                const unlocked = owned.has(badge.id);
                const displayName = isZh ? badge.nameZh ?? badge.name : badge.name;
                const displayDesc = isZh ? badge.descriptionZh ?? badge.description : badge.description;

                return (
                  <article className={unlocked ? "is-unlocked" : "is-locked"} key={badge.id}>
                    <span>{unlocked ? "◉" : "○"}</span>
                    <strong>{displayName}</strong>
                    <small>{displayDesc || badge.verificationGrade}</small>
                  </article>
                );
              }) : <p className="proto-dashboard-empty">{isZh ? "徽章定义尚未配置。" : "Badge definitions are not configured yet."}</p>}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
