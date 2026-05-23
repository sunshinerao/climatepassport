import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getPrismaClient } from "@/lib/server/prisma";
import { getDashboardPathForRole, requireAuthenticatedUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

const PROFILE_FIELDS: Array<"name" | "email" | "title" | "bio" | "avatar" | "phone" | "country" | "climatePassportId"> = [
  "name",
  "email",
  "title",
  "bio",
  "avatar",
  "phone",
  "country",
  "climatePassportId",
];

const ACHIEVEMENT_ICONS = ["🌱", "🏅", "📜", "🎓", "🌍", "⭐", "🛡️", "🔥", "💎"];

export default async function LocalizedDashboardPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";

  const [
    registrationCount,
    notificationCount,
    recentCerts,
    unlockedAchievementsCount,
    profileUser,
    upcomingRegistrations,
    achievementDefinitions,
    userAchievements,
  ] = prisma
    ? await Promise.all([
        prisma.registration.count({ where: { userId: user.id } }),
        prisma.notification.count({ where: { userId: user.id, status: { in: ["DELIVERED", "QUEUED"] } } }),
        prisma.certificateIssue.findMany({
          where: { userId: user.id },
          take: 6,
          orderBy: { createdAt: "desc" },
          include: { definition: { include: { category: true } } },
        }),
        prisma.userAchievement.count({ where: { userId: user.id } }),
        prisma.user.findUnique({
          where: { id: user.id },
          select: {
            points: true,
            name: true,
            email: true,
            title: true,
            bio: true,
            avatar: true,
            phone: true,
            country: true,
            climatePassportId: true,
          },
        }),
        prisma.registration.findMany({
          where: { userId: user.id, status: { in: ["REGISTERED", "ATTENDED", "PENDING_APPROVAL"] } },
          take: 4,
          orderBy: { createdAt: "desc" },
          include: {
            event: {
              select: {
                title: true,
                titleEn: true,
                startDate: true,
                venue: true,
                venueEn: true,
              },
            },
          },
        }),
        prisma.achievementDefinition.findMany({
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { pointThreshold: "asc" }],
          take: 9,
        }),
        prisma.userAchievement.findMany({
          where: { userId: user.id },
          select: { achievementDefinitionId: true },
        }),
      ])
    : [0, 0, [], 0, null, [], [], []];

  const userPoints = (profileUser as { points: number } | null)?.points ?? 0;
  const isAdminUser = user.role === "ADMIN" || user.role === "EVENT_MANAGER";
  const levelThreshold = 500;
  const progressPct = Math.min(100, Math.round(((userPoints % levelThreshold) / levelThreshold) * 100));
  const level = Math.floor(userPoints / levelThreshold) + 1;

  const profileFieldValues = PROFILE_FIELDS.map((key) =>
    (profileUser as Record<string, unknown> | null)?.[key] ?? null,
  );
  const filledCount = profileFieldValues.filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  ).length;
  const profileCompletion = Math.round((filledCount / PROFILE_FIELDS.length) * 100);
  const ringCircumference = 2 * Math.PI * 70;
  const ringOffset = ringCircumference * (1 - profileCompletion / 100);

  const unlockedDefinitionIds = new Set(
    (userAchievements as Array<{ achievementDefinitionId: string }>).map((row) => row.achievementDefinitionId),
  );
  const achievementItems = (
    achievementDefinitions as Array<{
      id: string;
      name: string;
      nameEn: string | null;
      pointThreshold: number | null;
      order: number;
    }>
  ).map((def, index) => ({
    id: def.id,
    icon: ACHIEVEMENT_ICONS[index % ACHIEVEMENT_ICONS.length],
    name: isZh ? def.name : def.nameEn ?? def.name,
    pts: def.pointThreshold ?? 0,
    unlocked: unlockedDefinitionIds.has(def.id),
  }));

  return (
    <div className="proto-dashboard-page">
      <section className="proto-dashboard-shell">
        <aside className="proto-dashboard-passport">
          <div className="proto-dashboard-passport-top">
            <span>{isZh ? "Climate Passport 档案" : "Climate Passport Record"}</span>
            <strong>{user.role}</strong>
          </div>
          <div className="proto-dashboard-passport-id">{user.climatePassportId ?? (isZh ? "待生成身份号" : "Passport ID pending")}</div>
          <h1>{isZh ? `欢迎回来，${user.name}` : `Welcome back, ${user.name}`}</h1>
          <p>
            {isZh
              ? "你的活动、学习和证书记录已经同步到统一 Passport 档案。"
              : "Your event, learning and certificate records are now synchronized into one Passport archive."}
          </p>
          <div className="proto-dashboard-passport-stats">
            <article>
              <strong>{userPoints}</strong>
              <span>{isZh ? "积分" : "Points"}</span>
            </article>
            <article>
              <strong>{registrationCount as number}</strong>
              <span>{isZh ? "活动参与" : "Participations"}</span>
            </article>
            <article>
              <strong>{(recentCerts as unknown[]).length}</strong>
              <span>{isZh ? "证书" : "Certificates"}</span>
            </article>
          </div>
          <div className="proto-dashboard-level-row">
            <span>{isZh ? `Lv.${level} 进度` : `Level ${level} progress`}</span>
            <strong>{progressPct}%</strong>
          </div>
          <div className="proto-dashboard-level-track">
            <div style={{ width: `${progressPct}%` }} />
          </div>
          <Link className="button" href={`/${params.locale}/dashboard/climate-passport`}>
            {isZh ? "打开我的 Passport" : "Open my Passport"}
          </Link>
        </aside>

        <div className="proto-dashboard-main">
          <div className="proto-dashboard-kpis">
            <article>
              <span>{isZh ? "通知待处理" : "Pending notifications"}</span>
              <strong>{notificationCount as number}</strong>
            </article>
            <article>
              <span>{isZh ? "已解锁成就" : "Unlocked achievements"}</span>
              <strong>{unlockedAchievementsCount as number}</strong>
            </article>
            <article className="proto-dashboard-ring-card">
              <div className="proto-dashboard-ring">
                <svg viewBox="0 0 160 160" aria-hidden="true">
                  <circle cx="80" cy="80" r="70" className="proto-ring-track" />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    className="proto-ring-progress"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <div className="proto-dashboard-ring-label">
                  <strong>{profileCompletion}%</strong>
                  <span>{isZh ? "资料完整度" : "Profile"}</span>
                </div>
              </div>
              <p>{isZh ? `已填写 ${filledCount} / ${PROFILE_FIELDS.length} 个字段` : `${filledCount} of ${PROFILE_FIELDS.length} fields completed`}</p>
            </article>
          </div>

          <section className="proto-dashboard-panel">
            <div className="proto-dashboard-panel-head">
              <h2>{isZh ? "近期日程" : "Upcoming timeline"}</h2>
              <Link href={`/${params.locale}/events`}>{isZh ? "查看全部" : "View all"}</Link>
            </div>
            <div className="proto-dashboard-timeline">
              {(upcomingRegistrations as Array<{ id: string; status: string; event: { title: string; titleEn: string | null; startDate: Date; venue: string; venueEn: string | null } }>).length > 0 ? (
                (upcomingRegistrations as Array<{ id: string; status: string; event: { title: string; titleEn: string | null; startDate: Date; venue: string; venueEn: string | null } }>).map((item) => {
                  const date = new Date(item.event.startDate);
                  const month = date.toLocaleString(isZh ? "zh-CN" : "en-US", { month: "short" });
                  const day = date.getDate();
                  return (
                    <article key={item.id}>
                      <div className="proto-dashboard-datebox" aria-hidden="true">
                        <span className="proto-dashboard-datebox-month">{month}</span>
                        <strong className="proto-dashboard-datebox-day">{day}</strong>
                      </div>
                      <div className="proto-dashboard-timeline-body">
                        <strong>{isZh ? item.event.title : item.event.titleEn ?? item.event.title}</strong>
                        <p>{date.toLocaleDateString()} · {isZh ? item.event.venue : item.event.venueEn ?? item.event.venue}</p>
                      </div>
                      <span className="proto-dashboard-timeline-status">{item.status}</span>
                    </article>
                  );
                })
              ) : (
                <p className="proto-dashboard-empty">{isZh ? "暂无日程记录" : "No timeline records yet"}</p>
              )}
            </div>
          </section>

          <section className="proto-dashboard-panel">
            <div className="proto-dashboard-panel-head">
              <h2>{isZh ? "证书与归档" : "Certificates & archive"}</h2>
              <Link href={`/${params.locale}/dashboard/certificates`}>{isZh ? "我的证书" : "My certificates"}</Link>
            </div>
            <div className="proto-dashboard-certs">
              {(recentCerts as Array<{
                id: string;
                status: string;
                definition: { name: string; nameEn?: string | null; category: { name: string } };
                issuedAt: Date | null;
              }>).slice(0, 4).map((cert) => (
                <article key={cert.id}>
                  <h3>{isZh ? cert.definition.name : cert.definition.nameEn ?? cert.definition.name}</h3>
                  <p>{cert.definition.category.name}</p>
                  <span>{cert.status === "ISSUED" ? (isZh ? "已签发" : "Issued") : cert.status}</span>
                </article>
              ))}
              {(recentCerts as unknown[]).length === 0 ? (
                <p className="proto-dashboard-empty">{isZh ? "参与活动后将自动生成证书。" : "Certificates will appear automatically after participation."}</p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="proto-dashboard-side">
          <section className="proto-dashboard-panel">
            <div className="proto-dashboard-panel-head">
              <h2>{isZh ? "成就墙" : "Achievement wall"}</h2>
            </div>
            <div className="proto-dashboard-badges">
              {achievementItems.length > 0 ? (
                achievementItems.map((item) => (
                  <article className={item.unlocked ? "is-unlocked" : "is-locked"} key={item.id}>
                    <span>{item.icon}</span>
                    <strong>{item.name}</strong>
                    <small>{item.pts > 0 ? `+${item.pts}` : (item.unlocked ? (isZh ? "已解锁" : "Earned") : (isZh ? "未解锁" : "Locked"))}</small>
                  </article>
                ))
              ) : (
                <p className="proto-dashboard-empty">{isZh ? "成就体系正在配置中。" : "Achievement catalog is being configured."}</p>
              )}
            </div>
          </section>

          <section className="proto-dashboard-panel">
            <div className="proto-dashboard-panel-head">
              <h2>{isZh ? "快捷操作" : "Quick actions"}</h2>
            </div>
            <div className="proto-dashboard-actions">
              <Link href={`/${params.locale}/dashboard/learning-experiences`}>{isZh ? "学习经历申请" : "Learning applications"}</Link>
              <Link href={`/${params.locale}/dashboard/summer-school`}>{isZh ? "可持续夏校申请" : "Summer school apply"}</Link>
              <Link href={`/${params.locale}/dashboard/notifications`}>{isZh ? "通知偏好" : "Notification preferences"}</Link>
              <Link href={`/${params.locale}/dashboard/messages`}>{isZh ? "消息中心" : "Messages center"}</Link>
              {isAdminUser ? <Link href={getDashboardPathForRole(params.locale, user.role)}>{isZh ? "进入后台" : "Open admin"}</Link> : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
