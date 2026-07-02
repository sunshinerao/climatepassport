import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function ActivityPosterPage({ params }: { params: { locale: Locale; slug: string } }) {
  noStore();
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const zh = params.locale === "zh";

  const activityRaw = await prisma.activity.findUnique({
    where: { slug: params.slug },
  });

  if (!activityRaw || activityRaw.visibility === "PRIVATE") notFound();

  const activity = activityRaw as typeof activityRaw & {
    subtitle?: string | null;
    subtitleEn?: string | null;
    organizerName?: string | null;
    posterImage?: string | null;
    locationJson?: Record<string, string> | null;
    timezone?: string;
  };

  const title = zh ? activity.title : (activity.titleEn ?? activity.title);
  const subtitle = zh ? activity.subtitle : (activity.subtitleEn ?? activity.subtitle);
  const locationJson = activity.locationJson as Record<string, string> | null;
  const venue = zh
    ? (locationJson?.name ?? locationJson?.venue ?? "")
    : (locationJson?.nameEn ?? locationJson?.venueEn ?? locationJson?.name ?? locationJson?.venue ?? "");
  const detailUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${params.locale}/activities/${params.slug}`;

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString(zh ? "zh-CN" : "en-US", {
      timeZone: (activity.timezone as string) ?? "Asia/Shanghai",
      year: "numeric", month: "long", day: "numeric",
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0fdf4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "var(--cp-font-sans)",
      }}
    >
      <div
        id="poster"
        style={{
          width: 600,
          background: "#fff",
          borderRadius: "1rem",
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
        }}
      >
        {/* Cover image */}
        {activity.posterImage ? (
          <img
            alt={title}
            src={activity.posterImage}
            style={{ width: "100%", height: 280, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: 200, background: "linear-gradient(135deg, #16a34a, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "var(--cp-fs-72)", color: "rgba(255,255,255,0.5)" }}>🌍</span>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "2rem" }}>
          <div style={{ fontSize: "var(--cp-text-small)", color: "#16a34a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
            {zh ? "活动" : "EVENT"}
          </div>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "var(--cp-fs-r-1-8)", lineHeight: 1.2, color: "#111827" }}>{title}</h1>
          {subtitle && <p style={{ margin: "0 0 1.5rem", color: "#6b7280", fontSize: "var(--cp-text-body)" }}>{subtitle}</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
            {activity.startTime && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ fontSize: "var(--cp-fs-20)" }}>📅</span>
                <span style={{ color: "#374151", fontSize: "var(--cp-text-body)" }}>
                  {formatDate(activity.startTime as Date)}
                  {activity.endTime && (activity.endTime as Date).toDateString() !== (activity.startTime as Date).toDateString()
                    ? ` – ${formatDate(activity.endTime as Date)}`
                    : ""}
                </span>
              </div>
            )}
            {venue && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ fontSize: "var(--cp-fs-20)" }}>📍</span>
                <span style={{ color: "#374151", fontSize: "var(--cp-text-body)" }}>{venue}</span>
              </div>
            )}
            {activity.organizerName && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ fontSize: "var(--cp-fs-20)" }}>🏢</span>
                <span style={{ color: "#374151", fontSize: "var(--cp-text-body)" }}>{activity.organizerName}</span>
              </div>
            )}
          </div>

          {/* QR Code + URL */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", padding: "1rem", background: "#f9fafb", borderRadius: "0.75rem" }}>
            <img
              alt="QR"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(detailUrl)}`}
              style={{ width: 100, height: 100, borderRadius: "0.5rem", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: "var(--cp-text-caption)", color: "#9ca3af", marginBottom: "0.25rem" }}>
                {zh ? "扫码查看详情 / 报名" : "Scan to view details & register"}
              </div>
              <div style={{ fontSize: "var(--cp-text-caption)", color: "#6b7280", wordBreak: "break-all" }}>{detailUrl}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Print button (non-print) */}
      <div className="no-print" style={{ position: "fixed", bottom: "2rem", right: "2rem" }}>
        <button
            style={{ padding: "0.75rem 1.5rem", background: "#16a34a", color: "#fff", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600, fontSize: "var(--cp-text-small)" }}
          onClick={() => window.print()}
        >
          {zh ? "🖨️ 打印 / 保存" : "🖨️ Print / Save"}
        </button>
      </div>
    </div>
  );
}
