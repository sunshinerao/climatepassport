import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPrismaClient } from "@/lib/server/prisma";
import { getCurrentUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

type Dimension = "individual" | "organization" | "country";
type Period = "all_time" | "weekly" | "daily";

const DIMENSION_LABELS: Record<Dimension, Record<"zh" | "en", string>> = {
  individual: { zh: "个人榜", en: "Individual" },
  organization: { zh: "机构榜", en: "Organization" },
  country: { zh: "国家/地区榜", en: "Country / Region" },
};

const PERIOD_LABELS: Record<Period, Record<"zh" | "en", string>> = {
  all_time: { zh: "总榜", en: "All Time" },
  weekly: { zh: "本周榜", en: "This Week" },
  daily: { zh: "今日榜", en: "Today" },
};

function startOfDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export default async function ActivityLeaderboardPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; slug: string };
  searchParams: { dim?: string; period?: string };
}) {
  noStore();
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const zh = params.locale === "zh";

  const dim: Dimension =
    searchParams.dim === "organization" || searchParams.dim === "country"
      ? searchParams.dim
      : "individual";

  const period: Period =
    searchParams.period === "weekly" || searchParams.period === "daily"
      ? searchParams.period
      : "all_time";

  const activity = await prisma.activity.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true, titleEn: true, slug: true, type: true, status: true, visibility: true },
  });

  if (
    !activity ||
    activity.visibility === "PRIVATE" ||
    (activity.status !== "PUBLISHED" && activity.status !== "ONGOING" && activity.status !== "COMPLETED")
  ) {
    notFound();
  }

  const activityTitle = zh ? activity.title : (activity.titleEn ?? activity.title);
  const currentUser = await getCurrentUser();
  const locale = params.locale;

  function tabUrl(d: Dimension, p: Period) {
    return `/${locale}/activities/${params.slug}/leaderboard?dim=${d}&period=${p}`;
  }

  // ── Individual board ────────────────────────────────────────────────────────
  type IndividualEntry = {
    rank: number;
    userId: string;
    name: string;
    climatePassportId: string | null;
    points: number;
    badgeCount: number;
    isCurrentUser: boolean;
  };

  let individualBoard: IndividualEntry[] = [];
  let currentUserRank: number | null = null;

  if (dim === "individual") {
    if (period === "all_time") {
      const rows = await prisma.activityParticipation.findMany({
        where: {
          activityId: activity.id,
          status: { in: ["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CERTIFIED"] },
        },
        orderBy: { pointsEarned: "desc" },
        take: 100,
        select: { userId: true, pointsEarned: true, badgeAwardIds: true },
      });

      const userIds = rows.map((r) => r.userId);
      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, climatePassportId: true },
            })
          : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      individualBoard = rows.map((r, i) => {
        const u = userMap.get(r.userId);
        return {
          rank: i + 1,
          userId: r.userId,
          name: u?.name ?? "—",
          climatePassportId: u?.climatePassportId ?? null,
          points: r.pointsEarned,
          badgeCount: r.badgeAwardIds.length,
          isCurrentUser: currentUser?.id === r.userId,
        };
      });
    } else {
      const since = period === "daily" ? startOfDay() : startOfWeek();

      const txGroups = await prisma.pointTransaction.groupBy({
        by: ["userId"],
        where: { activityId: activity.id, createdAt: { gte: since }, points: { gt: 0 } },
        _sum: { points: true },
        orderBy: { _sum: { points: "desc" } },
        take: 100,
      });

      const userIds = txGroups.map((g) => g.userId);
      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, climatePassportId: true },
            })
          : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      const badgeCounts = await prisma.activityParticipation.findMany({
        where: { activityId: activity.id, userId: { in: userIds } },
        select: { userId: true, badgeAwardIds: true },
      });
      const badgeMap = new Map(badgeCounts.map((b) => [b.userId, b.badgeAwardIds.length]));

      individualBoard = txGroups.map((g, i) => {
        const u = userMap.get(g.userId);
        return {
          rank: i + 1,
          userId: g.userId,
          name: u?.name ?? "—",
          climatePassportId: u?.climatePassportId ?? null,
          points: g._sum.points ?? 0,
          badgeCount: badgeMap.get(g.userId) ?? 0,
          isCurrentUser: currentUser?.id === g.userId,
        };
      });
    }

    if (currentUser) {
      const myEntry = individualBoard.find((e) => e.isCurrentUser);
      if (myEntry) {
        currentUserRank = myEntry.rank;
      } else if (period === "all_time") {
        const me = await prisma.activityParticipation.findUnique({
          where: { activityId_userId: { activityId: activity.id, userId: currentUser.id } },
          select: { pointsEarned: true },
        });
        if (me) {
          const above = await prisma.activityParticipation.count({
            where: {
              activityId: activity.id,
              status: { in: ["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CERTIFIED"] },
              pointsEarned: { gt: me.pointsEarned },
            },
          });
          currentUserRank = above + 1;
        }
      }
    }
  }

  // ── Organization board ──────────────────────────────────────────────────────
  type OrgEntry = { rank: number; orgName: string; memberCount: number; points: number };
  let orgBoard: OrgEntry[] = [];

  if (dim === "organization") {
    const since =
      period === "daily" ? startOfDay() : period === "weekly" ? startOfWeek() : null;

    const parts = await prisma.activityParticipation.findMany({
      where: {
        activityId: activity.id,
        status: { in: ["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CERTIFIED"] },
      },
      select: { userId: true, pointsEarned: true },
    });

    const userIds = parts.map((p) => p.userId);
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, organization: { select: { name: true } } },
      });
      const orgNameMap = new Map(users.map((u) => [u.id, u.organization?.name ?? null]));

      let pointsByUser: Map<string, number>;
      if (since) {
        const txGroups = await prisma.pointTransaction.groupBy({
          by: ["userId"],
          where: {
            activityId: activity.id,
            createdAt: { gte: since },
            points: { gt: 0 },
            userId: { in: userIds },
          },
          _sum: { points: true },
        });
        pointsByUser = new Map(txGroups.map((g) => [g.userId, g._sum.points ?? 0]));
      } else {
        pointsByUser = new Map(parts.map((p) => [p.userId, p.pointsEarned]));
      }

      const orgAgg = new Map<string, { memberCount: number; points: number }>();
      for (const uid of userIds) {
        const org = orgNameMap.get(uid) ?? (zh ? "（无机构）" : "(No organization)");
        const pts = pointsByUser.get(uid) ?? 0;
        const cur = orgAgg.get(org) ?? { memberCount: 0, points: 0 };
        orgAgg.set(org, { memberCount: cur.memberCount + 1, points: cur.points + pts });
      }

      orgBoard = Array.from(orgAgg.entries())
        .map(([orgName, v]) => ({ orgName, ...v }))
        .sort((a, b) => b.points - a.points || b.memberCount - a.memberCount)
        .slice(0, 100)
        .map((e, i) => ({ rank: i + 1, ...e }));
    }
  }

  // ── Country board ───────────────────────────────────────────────────────────
  type CountryEntry = { rank: number; country: string; memberCount: number; points: number };
  let countryBoard: CountryEntry[] = [];

  if (dim === "country") {
    const since =
      period === "daily" ? startOfDay() : period === "weekly" ? startOfWeek() : null;

    const parts = await prisma.activityParticipation.findMany({
      where: {
        activityId: activity.id,
        status: { in: ["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CERTIFIED"] },
      },
      select: { userId: true, pointsEarned: true },
    });

    const userIds = parts.map((p) => p.userId);
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, country: true },
      });
      const countryMap = new Map(users.map((u) => [u.id, u.country ?? null]));

      let pointsByUser: Map<string, number>;
      if (since) {
        const txGroups = await prisma.pointTransaction.groupBy({
          by: ["userId"],
          where: {
            activityId: activity.id,
            createdAt: { gte: since },
            points: { gt: 0 },
            userId: { in: userIds },
          },
          _sum: { points: true },
        });
        pointsByUser = new Map(txGroups.map((g) => [g.userId, g._sum.points ?? 0]));
      } else {
        pointsByUser = new Map(parts.map((p) => [p.userId, p.pointsEarned]));
      }

      const cAgg = new Map<string, { memberCount: number; points: number }>();
      for (const uid of userIds) {
        const country = countryMap.get(uid) ?? (zh ? "（未知）" : "Unknown");
        const pts = pointsByUser.get(uid) ?? 0;
        const cur = cAgg.get(country) ?? { memberCount: 0, points: 0 };
        cAgg.set(country, { memberCount: cur.memberCount + 1, points: cur.points + pts });
      }

      countryBoard = Array.from(cAgg.entries())
        .map(([country, v]) => ({ country, ...v }))
        .sort((a, b) => b.points - a.points || b.memberCount - a.memberCount)
        .slice(0, 100)
        .map((e, i) => ({ rank: i + 1, ...e }));
    }
  }

  function medal(rank: number) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  }

  return (
    <div className="page">
      <nav >
        <Link href={`/${locale}/activities`}>{zh ? "活动" : "Activities"}</Link>
        <span>›</span>
        <Link href={`/${locale}/activities/${params.slug}`}>{activityTitle}</Link>
        <span>›</span>
        <span>{zh ? "排行榜" : "Leaderboard"}</span>
      </nav>

      <div className="section-header">
        <div>
          <span className="chip" style={{ marginBottom: "0.5rem", display: "inline-block" }}>
            {activity.type}
          </span>
          <h1 className="label">{zh ? "排行榜" : "Leaderboard"}</h1>
          <p style={{ color: "var(--color-text-muted)" }}>{activityTitle}</p>
        </div>
        {dim === "individual" && currentUser && currentUserRank && (
          <div className="data-card" style={{ minWidth: "160px", textAlign: "center" }}>
            <div >#{currentUserRank}</div>
            <div >{zh ? "我的排名" : "My Rank"}</div>
          </div>
        )}
      </div>

      {/* Dimension tabs */}
      <div className="cert-admin-tabs" style={{ marginBottom: "0.5rem" }}>
        {(["individual", "organization", "country"] as const).map((d) => (
          <Link
            key={d}
            href={tabUrl(d, period)}
            className={`cert-admin-tab${dim === d ? " cert-admin-tab active" : ""}`}
          >
            {DIMENSION_LABELS[d][zh ? "zh" : "en"]}
          </Link>
        ))}
      </div>

      {/* Period tabs */}
      <div className="cert-admin-tabs" style={{ marginBottom: "1.5rem" }}>
        {(["all_time", "weekly", "daily"] as const).map((p) => (
          <Link
            key={p}
            href={tabUrl(dim, p)}
            className={`cert-admin-tab${period === p ? " cert-admin-tab active" : ""}`}
          >
            {PERIOD_LABELS[p][zh ? "zh" : "en"]}
          </Link>
        ))}
      </div>

      {/* Individual */}
      {dim === "individual" && (
        <div className="section">
          {individualBoard.length === 0 ? (
            <div className="form-error form-success">
              {zh ? "暂无排行数据" : "No participants on the leaderboard yet"}
            </div>
          ) : (
            <div >
              <table className="tableish">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>{zh ? "排名" : "Rank"}</th>
                    <th>{zh ? "姓名" : "Name"}</th>
                    <th>{zh ? "护照号" : "Passport ID"}</th>
                    <th style={{ textAlign: "right" }}>
                      {period === "all_time" ? (zh ? "总积分" : "Total Points") : (zh ? "积分" : "Points")}
                    </th>
                    <th style={{ textAlign: "right" }}>{zh ? "徽章" : "Badges"}</th>
                  </tr>
                </thead>
                <tbody>
                  {individualBoard.map((entry) => (
                    <tr
                      key={entry.userId}
                      style={
                        entry.isCurrentUser
                          ? { background: "var(--color-accent-subtle, #eff6ff)", fontWeight: 600 }
                          : undefined
                      }
                    >
                      <td>
                        {medal(entry.rank)}
                        {entry.isCurrentUser && (
                          <span style={{ marginLeft: "0.25rem", fontSize: "var(--cp-text-caption)", color: "var(--color-primary)" }}>
                            {zh ? "（我）" : "(you)"}
                          </span>
                        )}
                      </td>
                      <td>{entry.name}</td>
                      <td style={{ fontSize: "var(--cp-text-small)" }}>
                        {entry.climatePassportId ?? "—"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{entry.points}</td>
                      <td style={{ textAlign: "right" }}>{entry.badgeCount > 0 ? entry.badgeCount : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Organization */}
      {dim === "organization" && (
        <div className="section">
          {orgBoard.length === 0 ? (
            <div className="form-error form-success">
              {zh ? "暂无机构排行数据" : "No organization data available"}
            </div>
          ) : (
            <div >
              <table className="tableish">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>{zh ? "排名" : "Rank"}</th>
                    <th>{zh ? "机构名称" : "Organization"}</th>
                    <th style={{ textAlign: "right" }}>{zh ? "参与人数" : "Members"}</th>
                    <th style={{ textAlign: "right" }}>{zh ? "累计积分" : "Total Points"}</th>
                  </tr>
                </thead>
                <tbody>
                  {orgBoard.map((entry) => (
                    <tr key={entry.orgName}>
                      <td>{medal(entry.rank)}</td>
                      <td>{entry.orgName}</td>
                      <td style={{ textAlign: "right" }}>{entry.memberCount}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Country */}
      {dim === "country" && (
        <div className="section">
          {countryBoard.length === 0 ? (
            <div className="form-error form-success">
              {zh ? "暂无国家/地区排行数据" : "No country / region data available"}
            </div>
          ) : (
            <div >
              <table className="tableish">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>{zh ? "排名" : "Rank"}</th>
                    <th>{zh ? "国家/地区" : "Country / Region"}</th>
                    <th style={{ textAlign: "right" }}>{zh ? "参与人数" : "Participants"}</th>
                    <th style={{ textAlign: "right" }}>{zh ? "累计积分" : "Total Points"}</th>
                  </tr>
                </thead>
                <tbody>
                  {countryBoard.map((entry) => (
                    <tr key={entry.country}>
                      <td>{medal(entry.rank)}</td>
                      <td>{entry.country}</td>
                      <td style={{ textAlign: "right" }}>{entry.memberCount}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="section">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href={`/${locale}/activities/${params.slug}`} className="button button">
            {zh ? "← 返回活动详情" : "← Back to activity"}
          </Link>
          {!currentUser && (
            <Link href={`/${locale}/auth/login`} className="button button button">
              {zh ? "登录查看我的排名" : "Sign in to see your rank"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
