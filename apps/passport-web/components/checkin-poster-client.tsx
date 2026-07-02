"use client";

import type { Locale } from "@/lib/site-content";

interface CheckinPosterClientProps {
  locale: Locale;
  qrDataUrl: string | null;
  hasParticipation: boolean;
  activityData: {
    title: string;
    posterImage: string | null;
    startTime: string | null;
    endTime: string | null;
    venue: string;
    city: string;
  };
  userData: {
    displayName: string;
    passportId: string;
  };
}

export function CheckinPosterClient({
  locale,
  qrDataUrl,
  hasParticipation,
  activityData,
  userData,
}: CheckinPosterClientProps) {
  const zh = locale === "zh";

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(zh ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString(zh ? "zh-CN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="page" style={{ background: "var(--color-surface-dim, #f8fafc)", minHeight: "100vh" }}>
      {/* Toolbar — hidden on print */}
      <div className=" no-print" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "var(--cp-text-body-lg)", fontWeight: 700 }}>
            {zh ? "签到海报" : "Check-in Poster"}
          </h2>
          <p style={{ margin: "0.2rem 0 0", color: "var(--color-text-muted)", fontSize: "var(--cp-text-small)" }}>
            {zh ? "打印后在活动现场出示二维码完成签到" : "Print and show the QR code at the venue to check in"}
          </p>
        </div>
        <button
          className="button button"
          disabled={!qrDataUrl}
          onClick={() => window.print()}
        >
          {zh ? "打印 / 保存 PDF" : "Print / Save PDF"}
        </button>
      </div>

      {/* No participation warning */}
      {!hasParticipation && (
        <div className="form-error form-error no-print" style={{ maxWidth: 560, margin: "0 auto 1rem" }}>
          {zh ? "您尚未报名参加此活动，无法生成签到二维码。请先完成活动报名。" : "You are not registered for this activity. Please register first."}
        </div>
      )}

      {/* Poster card */}
      <div
        id="checkin-poster"
        style={{
          maxWidth: 560,
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: "1rem",
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.10)",
          fontFamily: "var(--cp-font-sans)",
        }}
      >
        {/* Banner */}
        {activityData.posterImage ? (
          <img
            alt={activityData.title}
            src={activityData.posterImage}
            style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: 160,
              background: "linear-gradient(135deg, #16a34a 0%, #0ea5e9 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "var(--cp-fs-64)", opacity: 0.7 }}>🌱</span>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "1.75rem 2rem" }}>
          {/* Badge */}
          <div style={{ display: "inline-block", background: "#dcfce7", color: "#15803d", fontSize: "var(--cp-text-caption)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.25rem 0.65rem", borderRadius: "2rem", marginBottom: "0.75rem" }}>
            {zh ? "气候护照 · 签到凭证" : "Climate Passport · Check-in"}
          </div>

          {/* Activity title */}
          <h1 style={{ fontSize: "var(--cp-fs-20)", fontWeight: 800, color: "#0f172a", margin: "0 0 0.5rem", lineHeight: 1.3 }}>
            {activityData.title}
          </h1>

          {/* Date / Venue */}
          <div style={{ fontSize: "var(--cp-text-small)", color: "#475569", marginBottom: "1.25rem", lineHeight: 1.6 }}>
            {activityData.startTime && (
              <div>
                📅 {formatDate(activityData.startTime)}
                {" "}{formatTime(activityData.startTime)}
                {activityData.endTime && ` – ${formatTime(activityData.endTime)}`}
              </div>
            )}
            {(activityData.venue || activityData.city) && (
              <div>
                📍 {[activityData.venue, activityData.city].filter(Boolean).join("，")}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #e2e8f0", marginBottom: "1.25rem" }} />

          {/* Attendee info */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #16a34a, #0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#fff",
                fontWeight: 700,
                fontSize: "var(--cp-fs-20)",
              }}
            >
              {userData.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "var(--cp-text-body)" }}>{userData.displayName}</div>
              {userData.passportId && (
                <div style={{ fontSize: "var(--cp-text-caption)", color: "#64748b", fontFamily: "var(--cp-font-mono)" }}>
                  {zh ? "护照 ID: " : "Passport ID: "}{userData.passportId}
                </div>
              )}
            </div>
          </div>

          {/* QR Code */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1.25rem",
              background: "#f0fdf4",
              borderRadius: "0.75rem",
              border: "1px solid #bbf7d0",
            }}
          >
            {qrDataUrl ? (
              <>
                <img
                  alt="Check-in QR Code"
                  src={qrDataUrl}
                  style={{ width: 180, height: 180, display: "block", imageRendering: "pixelated" }}
                />
                <div style={{ fontSize: "var(--cp-text-caption)", color: "#64748b", textAlign: "center" }}>
                  {zh ? "扫描此二维码完成活动签到" : "Scan this QR code to check in at the event"}
                </div>
              </>
            ) : (
              <div style={{ color: hasParticipation ? "#dc2626" : "#64748b", fontSize: "var(--cp-text-small)", padding: "1.5rem", textAlign: "center" }}>
                {hasParticipation
                  ? (zh ? "签到二维码生成失败，请刷新页面" : "Failed to generate QR code. Please refresh.")
                  : (zh ? "报名后方可生成签到二维码" : "Register for this activity to get your check-in QR code")}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ marginTop: "1.25rem", textAlign: "center", fontSize: "var(--cp-text-caption)", color: "#94a3b8" }}>
            {zh ? "本二维码为个人专属，请勿转发他人使用" : "This QR code is personal. Do not share or transfer."}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          #checkin-poster {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
