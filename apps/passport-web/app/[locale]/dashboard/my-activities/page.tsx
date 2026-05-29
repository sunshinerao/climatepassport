import { unstable_noStore as noStore } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";
import Link from "next/link";
import MyActivitiesClient from "@/components/my-activities-client";

export default async function MyActivitiesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/my-activities`);
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const zh = params.locale === "zh";

  const [participations, applications, upcomingEventApplications] = await Promise.all([
    prisma.activityParticipation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        activity: {
          select: {
            id: true, type: true, title: true, titleEn: true, slug: true,
            status: true, startTime: true,
          },
        },
      },
    }),
    prisma.activityApplication.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        activity: {
          select: {
            id: true, type: true, title: true, titleEn: true, slug: true,
            status: true, startTime: true,
          },
        },
      },
    }),
    // Upcoming EVENT-type: registrations/applications with future startTime
    prisma.activityParticipation.findMany({
      where: {
        userId: user.id,
        status: { in: ["REGISTERED", "IN_PROGRESS"] },
        activity: {
          type: "EVENT",
          startTime: { gte: new Date() },
          status: { in: ["PUBLISHED", "ONGOING"] },
        },
      },
      orderBy: { activity: { startTime: "asc" } },
      take: 10,
      include: {
        activity: {
          select: {
            id: true, title: true, titleEn: true, slug: true,
            startTime: true, endTime: true, timezone: true,
            locationType: true, locationJson: true, onlineUrl: true,
            organizerName: true, eventLayer: true,
          } as any,
        },
      },
    }),
  ]);

  // Compute pending checkin / submission flags for IN_PROGRESS participations
  const inProgressIds = participations
    .filter((p) => ["IN_PROGRESS", "CHECKED_IN"].includes(p.status))
    .map((p) => p.activityId);

  const hasPendingCheckin: Record<string, boolean> = {};
  const hasPendingSubmission: Record<string, boolean> = {};

  if (inProgressIds.length > 0) {
    const [checkinTasks, submissionTasks, userCheckins, userSubmissions] = await Promise.all([
      prisma.activityTask.findMany({
        where: { activityId: { in: inProgressIds }, requiresCheckin: true, isRequired: true },
        select: { id: true, activityId: true },
      }),
      prisma.activityTask.findMany({
        where: { activityId: { in: inProgressIds }, requiresSubmission: true, isRequired: true },
        select: { id: true, activityId: true },
      }),
      prisma.activityCheckinRecord.findMany({
        where: { userId: user.id, activityId: { in: inProgressIds }, status: "VALID" },
        select: { taskId: true },
      }),
      prisma.activitySubmission.findMany({
        where: {
          userId: user.id,
          activityId: { in: inProgressIds },
          status: { in: ["SUBMITTED", "APPROVED"] },
        },
        select: { taskId: true },
      }),
    ]);

    const doneCheckinTaskIds = new Set(userCheckins.map((c) => c.taskId).filter(Boolean));
    const doneSubmissionTaskIds = new Set(userSubmissions.map((s) => s.taskId).filter(Boolean));

    for (const t of checkinTasks) {
      if (!doneCheckinTaskIds.has(t.id)) hasPendingCheckin[t.activityId] = true;
    }
    for (const t of submissionTasks) {
      if (!doneSubmissionTaskIds.has(t.id)) hasPendingSubmission[t.activityId] = true;
    }
  }

  const totalPoints = participations.reduce((sum, p) => sum + p.pointsEarned, 0);
  const completedCount = participations.filter(
    (p) => p.status === "COMPLETED" || p.status === "CERTIFIED"
  ).length;

  // Build unified card list
  const participationCards = participations.map((p) => ({
    id: p.id,
    activityId: p.activityId,
    slug: p.activity?.slug ?? "",
    title: p.activity?.title ?? "—",
    titleEn: p.activity?.titleEn ?? null,
    type: p.activity?.type ?? "",
    activityStatus: p.activity?.status ?? "",
    participationStatus: p.status,
    pointsEarned: p.pointsEarned,
    badgeCount: p.badgeAwardIds.length,
    hasCertificate: !!p.certificateIssueId,
    passportSynced: p.passportSynced,
    startTime: p.activity?.startTime?.toISOString() ?? null,
    completedAt: p.completedAt?.toISOString() ?? null,
    hasPendingCheckin: hasPendingCheckin[p.activityId] ?? false,
    hasPendingSubmission: hasPendingSubmission[p.activityId] ?? false,
    isApplication: false as const,
    appStatus: null,
  }));

  const applicationCards = applications.map((a) => ({
    id: a.id,
    activityId: a.activityId,
    slug: a.activity?.slug ?? "",
    title: a.activity?.title ?? "—",
    titleEn: a.activity?.titleEn ?? null,
    type: a.activity?.type ?? "",
    activityStatus: a.activity?.status ?? "",
    participationStatus: null,
    pointsEarned: 0,
    badgeCount: 0,
    hasCertificate: false,
    passportSynced: false,
    startTime: a.activity?.startTime?.toISOString() ?? null,
    completedAt: null,
    hasPendingCheckin: false,
    hasPendingSubmission: false,
    isApplication: true as const,
    appStatus: a.status,
  }));

  const allCards = [...applicationCards, ...participationCards];

  return (
    <main className="section">
      <div >
        <h1>{zh ? "我的活动" : "My Activities"}</h1>
        <div className="chip-row">
          <div className="chip">
            <span >{applications.length}</span>
            <span >{zh ? "已报名" : "Applied"}</span>
          </div>
          <div className="chip">
            <span >{participations.length}</span>
            <span >{zh ? "参与中" : "Participating"}</span>
          </div>
          <div className="chip">
            <span >{completedCount}</span>
            <span >{zh ? "已完成" : "Completed"}</span>
          </div>
          <div className="chip">
            <span >{totalPoints}</span>
            <span >{zh ? "获得积分" : "Points"}</span>
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link className="button button-secondary button" href={`/${params.locale}/activities`}>
            {zh ? "浏览更多活动 →" : "Browse Activities →"}
          </Link>
          <Link className="button button" href={`/${params.locale}/dashboard/points`}>
            {zh ? "积分历史" : "Points History"}
          </Link>
        </div>
      </div>

      {/* Upcoming Events Schedule */}
      {upcomingEventApplications.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            📅 {zh ? "即将到来的活动日程" : "Upcoming Event Schedule"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {upcomingEventApplications.map((p) => {
              const a = p.activity as any;
              const title = zh ? a.title : (a.titleEn ?? a.title);
              const startDate = a.startTime ? new Date(a.startTime) : null;
              const loc = a.locationJson as Record<string, string> | null;
              const venueName = zh ? (loc?.name ?? loc?.venue) : (loc?.nameEn ?? loc?.venueEn ?? loc?.name ?? loc?.venue);
              return (
                <Link
                  href={`/${params.locale}/activities/${a.slug}`}
                  key={p.id}
                  style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1rem", borderRadius: "0.5rem", background: "#f0fdf4", border: "1px solid #bbf7d0", textDecoration: "none", color: "inherit" }}
                >
                  {startDate && (
                    <div style={{ minWidth: 48, textAlign: "center", background: "#16a34a", color: "#fff", borderRadius: "0.375rem", padding: "0.25rem 0.5rem" }}>
                      <div style={{ fontSize: "0.7rem", lineHeight: 1 }}>{startDate.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "short" })}</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, lineHeight: 1.1 }}>{startDate.getDate()}</div>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{title}</div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      {startDate && (
                        <span>{startDate.toLocaleString(zh ? "zh-CN" : "en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: a.timezone ?? "Asia/Shanghai" })}</span>
                      )}
                    {venueName && <span> · 📍 {venueName}</span>}
                    </div>
                  </div>
                  {a.eventLayer && (
                    <span className="chip chip" style={{ fontSize: "0.7rem", flexShrink: 0 }}>
                      {a.eventLayer}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {allCards.length === 0 ? (
        <div className="proto-admin-empty">
          <p>{zh ? "你还没有参与任何活动" : "You haven't participated in any activities yet"}</p>
          <Link className="button button" href={`/${params.locale}/activities`}>
            {zh ? "浏览活动" : "Browse Activities"}
          </Link>
        </div>
      ) : (
        <MyActivitiesClient cards={allCards} locale={params.locale} />
      )}
    </main>
  );
}
