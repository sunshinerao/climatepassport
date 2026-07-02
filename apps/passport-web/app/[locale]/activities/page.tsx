import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";
import { platformPageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  return platformPageMetadata(params.locale, "activities");
}

export default async function ActivitiesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const zh = params.locale === "zh";

  const activities = await prisma.activity.findMany({
    where: { status: { in: ["PUBLISHED", "ONGOING"] }, visibility: "PUBLIC" },
    orderBy: [{ isPinned: "desc" }, { isFeatured: "desc" }, { startTime: "asc" }],
    take: 80,
    select: {
      id: true,
      type: true,
      title: true,
      titleEn: true,
      slug: true,
      summary: true,
      summaryEn: true,
      coverImage: true,
      posterImage: true,
      status: true,
      startTime: true,
      endTime: true,
      locationType: true,
      isFeatured: true,
      isPinned: true,
      isPrivate: true,
      eventLayer: true,
      hostType: true,
      capacity: true,
      tags: true,
      organizerName: true,
      _count: { select: { participations: true } },
    } as any,
  });

  const TYPE_LABELS: Record<string, { zh: string; en: string }> = {
    EVENT: { zh: "活动", en: "Event" },
    LEARNING: { zh: "学习", en: "Learning" },
    CHALLENGE: { zh: "挑战", en: "Challenge" },
    PROJECT: { zh: "项目", en: "Project" },
    TASK: { zh: "任务", en: "Task" },
    COURSE: { zh: "课程", en: "Course" },
  };

  const STATUS_LABELS: Record<string, { zh: string; en: string }> = {
    PUBLISHED: { zh: "报名中", en: "Open" },
    ONGOING: { zh: "进行中", en: "Ongoing" },
  };

  const HOST_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
    OFFICIAL: { zh: "官方活动", en: "Official" },
    CO_HOSTED: { zh: "联合主办", en: "Co-hosted" },
    REGISTERED: { zh: "注册活动", en: "Registered" },
    SIDE_EVENT: { zh: "边会", en: "Side Event" },
    COMMUNITY: { zh: "社区活动", en: "Community" },
  };

  const EVENT_LAYER_LABELS: Record<string, { zh: string; en: string }> = {
    INSTITUTION: { zh: "机构", en: "Institution" },
    ECONOMY: { zh: "经济体", en: "Economy" },
    ROOT: { zh: "主办", en: "Official" },
    ACCELERATOR: { zh: "加速器", en: "Accelerator" },
    COMPREHENSIVE: { zh: "综合", en: "Comprehensive" },
  };

  // Pinned/featured events for banner
  const pinnedEvents = activities.filter((a: any) => a.isPinned && a.type === "EVENT");
  const normalActivities = activities.filter((a: any) => !a.isPinned);

  const TABS = [
    { key: "ALL", zh: "全部", en: "All" },
    { key: "EVENT", zh: "活动", en: "Events" },
    { key: "LEARNING", zh: "学习", en: "Learning" },
    { key: "CHALLENGE", zh: "挑战", en: "Challenges" },
    { key: "PROJECT", zh: "项目", en: "Projects" },
  ];

  return (
    <main className="page">
      <div className="section-header">
        <h1>{zh ? "活动中心" : "Activity Center"}</h1>
        <p className="compact-note">
          {zh
            ? "浏览并参与气候护照平台的各类活动、挑战与学习项目"
            : "Browse and participate in Climate Passport activities, challenges, and learning programs"}
        </p>
      </div>

      {/* Pinned events banner */}
      {pinnedEvents.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "var(--cp-text-body)", fontWeight: 700, color: "#dc2626", marginBottom: "0.75rem" }}>
            📌 {zh ? "置顶活动" : "Featured Events"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {pinnedEvents.map((a: any) => (
              <Link
                className="data-card"
                href={`/${params.locale}/activities/${a.slug}`}
                key={a.id}
                style={{ display: "flex", gap: "1rem", alignItems: "center", textDecoration: "none", color: "inherit" }}
              >
                {(a.posterImage || a.coverImage) && (
                  <img
                    alt={a.title}
                    src={a.posterImage ?? a.coverImage}
                    style={{ width: 80, height: 60, objectFit: "cover", borderRadius: "0.375rem", flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                    <span className="chip cpca-badge cpca-badge-blue" style={{ fontSize: "var(--cp-text-caption)" }}>{zh ? "活动" : "Event"}</span>
                    {a.eventLayer && (
                      <span className="chip chip" style={{ fontSize: "var(--cp-text-caption)" }}>
                        {EVENT_LAYER_LABELS[a.eventLayer]?.[zh ? "zh" : "en"] ?? a.eventLayer}
                      </span>
                    )}
                    {a.isPrivate && <span className="chip" style={{ fontSize: "var(--cp-text-caption)", background: "#7c3aed", color: "#fff" }}>{zh ? "闭门会" : "Closed"}</span>}
                  </div>
                  <div style={{ fontWeight: 600 }}>{zh ? a.title : (a.titleEn ?? a.title)}</div>
                  {a.startTime && (
                    <div style={{ fontSize: "var(--cp-text-small)", color: "#6b7280" }}>
                      📅 {new Date(a.startTime).toLocaleDateString(zh ? "zh-CN" : "en-US")}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Type filter tabs */}
      <div className="cert-admin-tabs" style={{ marginBottom: "1.25rem" }}>
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            className="cert-admin-tab"
            href={`/${params.locale}/activities${tab.key !== "ALL" ? `?type=${tab.key}` : ""}`}
          >
            {zh ? tab.zh : tab.en}
          </Link>
        ))}
      </div>

      {normalActivities.length === 0 ? (
        <div className="proto-admin-empty">
          <p>{zh ? "暂无公开活动" : "No activities available"}</p>
        </div>
      ) : (
        <div className="card-grid">
          {normalActivities.map((a: any) => (
            <Link className="data-card data-card" href={`/${params.locale}/activities/${a.slug}`} key={a.id}>
              {(a.posterImage || a.coverImage) && (
                <div >
                  <img alt={a.title} src={a.posterImage ?? a.coverImage} />
                </div>
              )}
              <div >
                <div >
                  <span className={`chip ${a.type === "EVENT" ? "cpca-badge cpca-badge-blue" : "chip"}`}>
                    {TYPE_LABELS[a.type]?.[zh ? "zh" : "en"] ?? a.type}
                  </span>
                  <span className={`chip ${a.status === "ONGOING" ? "cpca-badge cpca-badge-green" : ""}`}>
                    {STATUS_LABELS[a.status]?.[zh ? "zh" : "en"] ?? a.status}
                  </span>
                  {a.isFeatured && <span className="chip cpca-badge cpca-badge-amber">{zh ? "精选" : "Featured"}</span>}
                  {a.type === "EVENT" && a.eventLayer && (
                    <span className="chip chip" style={{ fontSize: "var(--cp-text-caption)" }}>
                      {EVENT_LAYER_LABELS[a.eventLayer]?.[zh ? "zh" : "en"] ?? a.eventLayer}
                    </span>
                  )}
                  {a.isPrivate && (
                    <span className="chip" style={{ fontSize: "var(--cp-text-caption)", background: "#7c3aed", color: "#fff" }}>
                      {zh ? "闭门会" : "Closed"}
                    </span>
                  )}
                </div>
                <h3 >{zh ? a.title : (a.titleEn ?? a.title)}</h3>
                {(zh ? a.summary : (a.summaryEn ?? a.summary)) && (
                  <p >{(zh ? a.summary : (a.summaryEn ?? a.summary))?.slice(0, 120)}</p>
                )}
                <div >
                  {a.startTime && (
                    <span >
                      📅 {new Date(a.startTime).toLocaleDateString(zh ? "zh-CN" : "en-US")}
                    </span>
                  )}
                  {a.locationType && (
                    <span >
                      {a.locationType === "ONLINE" ? (zh ? "线上" : "Online") : a.locationType === "OFFLINE" ? (zh ? "线下" : "In-person") : (zh ? "混合" : "Hybrid")}
                    </span>
                  )}
                  <span >
                    {zh ? `${a._count.participations} 人参与` : `${a._count.participations} joined`}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

