import { unstable_noStore as noStore } from "next/cache";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireRoleAccess } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";
import ActivityCheckinScannerClient from "@/components/activity-checkin-scanner-client";

export default async function ActivitiesCheckinPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER", "VERIFIER"], "/admin/activities-checkin");
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const zh = params.locale === "zh";

  // Fetch recent checkin records for live feed (last 20)
  const recentCheckins = await prisma.activityCheckinRecord.findMany({
    orderBy: { checkinAt: "desc" },
    take: 20,
    include: {
      activity: { select: { title: true } },
      task: { select: { title: true } },
    },
  });

  return (
    <main className="page">
      <div className="section-header">
        <div >
          <a href="/admin">{zh ? "管理中心" : "Admin"}</a>
          <span aria-hidden="true"> / </span>
          <span>{zh ? "活动签到核验" : "Activity Checkin Scanner"}</span>
        </div>
        <h1>{zh ? "活动签到核验" : "Activity Checkin Scanner"}</h1>
        <p className="compact-note">
          {zh ? "扫描参与者出示的二维码完成现场签到" : "Scan participant QR codes for on-site check-in"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        <div>
          <h2>{zh ? "扫码核验" : "QR Scanner"}</h2>
          <ActivityCheckinScannerClient locale={params.locale} />
        </div>

        <div>
          <h2>{zh ? "最近签到" : "Recent Checkins"}</h2>
          {recentCheckins.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>{zh ? "暂无签到记录" : "No recent checkins"}</p>
          ) : (
            <div className="list">
              {recentCheckins.map((record) => {
                const statusCls =
                  record.status === "VALID"
                    ? "cpca-badge cpca-badge-green"
                    : record.status === "DUPLICATE"
                    ? "cpca-badge cpca-badge-amber"
                    : "cpca-badge cpca-badge-red";
                return (
                  <div className="list-item" key={record.id} style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontFamily: "monospace", fontSize: "0.85em" }}>{record.userId}</div>
                      {record.activity && (
                        <div style={{ fontSize: "0.85em", color: "var(--color-text-muted)" }}>{record.activity.title}</div>
                      )}
                      {record.task && (
                        <div style={{ fontSize: "0.8em", color: "var(--color-text-muted)" }}>{record.task.title}</div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className={`chip ${statusCls}`}>{record.status}</span>
                      <div style={{ fontSize: "0.75em", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                        {new Date(record.checkinAt).toLocaleTimeString(zh ? "zh-CN" : "en-US")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
