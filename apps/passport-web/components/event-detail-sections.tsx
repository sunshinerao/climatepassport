"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-content";

type Speaker = {
  id: string;
  name: string;
  nameEn: string | null;
  title: string | null;
  titleEn: string | null;
  organization: string | null;
  organizationEn: string | null;
  avatar: string | null;
};

type AgendaSpeakerLink = { id: string; order: number; speaker: Speaker };

type AgendaItem = {
  id: string;
  agendaDate: string; // ISO string
  startTime: string;
  endTime: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  type: string;
  venue: string | null;
  venueEn: string | null;
  moderator: Speaker | null;
  speakers: AgendaSpeakerLink[];
};

const TYPE_LABELS_ZH: Record<string, string> = {
  session: "议题", keynote: "主旨演讲", panel: "圆桌", workshop: "工作坊",
  break: "茶歇", networking: "交流", other: "其他",
};

const TYPE_COLOR: Record<string, string> = {
  keynote: "#7c3aed", panel: "#0ea5e9", workshop: "#f59e0b",
  break: "#9ca3af", networking: "#10b981", session: "#3b82f6", other: "#6b7280",
};

function groupByDate(items: AgendaItem[]) {
  const map: Record<string, AgendaItem[]> = {};
  for (const item of items) {
    const d = item.agendaDate.slice(0, 10);
    if (!map[d]) map[d] = [];
    map[d].push(item);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export function EventDetailSections({
  agendaItems,
  locale,
}: {
  agendaItems: AgendaItem[];
  locale: Locale;
}) {
  const zh = locale === "zh";
  const groups = groupByDate(agendaItems);
  const [activeDate, setActiveDate] = useState<string>(groups[0]?.[0] ?? "");

  if (groups.length === 0) return null;

  const currentItems = groups.find(([d]) => d === activeDate)?.[1] ?? groups[0]?.[1] ?? [];

  return (
    <div>
      {/* Day tabs */}
      {groups.length > 1 && (
        <div className="cert-admin-tabs" style={{ marginBottom: "1rem" }}>
          {groups.map(([date]) => (
            <button
              className={`cert-admin-tab${activeDate === date ? " cert-admin-tab active" : ""}`}
              key={date}
              onClick={() => setActiveDate(date)}
            >
              {new Date(`${date}T12:00:00`).toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "short", day: "numeric" })}
            </button>
          ))}
        </div>
      )}

      {/* Agenda items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {[...currentItems]
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                gap: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                background: "#f9fafb",
                borderLeft: `4px solid ${TYPE_COLOR[item.type] ?? "#e5e7eb"}`,
              }}
            >
              {/* Time */}
              <div style={{ minWidth: "80px", fontSize: "var(--cp-text-small)", color: "#6b7280", fontVariantNumeric: "tabular-nums", paddingTop: 2 }}>
                <div>{item.startTime}</div>
                <div>{item.endTime}</div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                  <span
                    style={{
                      fontSize: "var(--cp-text-caption)",
                      fontWeight: 600,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: TYPE_COLOR[item.type] ?? "#e5e7eb",
                      color: "#fff",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {zh ? TYPE_LABELS_ZH[item.type] ?? item.type : item.type}
                  </span>
                  {item.venue && (
                    <span style={{ fontSize: "var(--cp-text-caption)", color: "#9ca3af" }}>
                      📍 {zh ? item.venue : (item.venueEn ?? item.venue)}
                    </span>
                  )}
                </div>

                <div style={{ fontWeight: 600, fontSize: "var(--cp-text-body)" }}>
                  {zh ? item.title : (item.titleEn ?? item.title)}
                </div>

                {(zh ? item.description : (item.descriptionEn ?? item.description)) && (
                  <div style={{ fontSize: "var(--cp-text-small)", color: "#6b7280", marginTop: "0.25rem" }}>
                    {zh ? item.description : (item.descriptionEn ?? item.description)}
                  </div>
                )}

                {/* Moderator */}
                {item.moderator && (
                  <div style={{ marginTop: "0.4rem", fontSize: "var(--cp-text-small)", color: "#6b7280" }}>
                    🎤 {zh ? "主持：" : "Moderator: "}
                    <span style={{ fontWeight: 500, color: "#374151" }}>
                      {zh ? item.moderator.name : (item.moderator.nameEn ?? item.moderator.name)}
                    </span>
                    {item.moderator.organization && (
                      <span style={{ color: "#9ca3af" }}> · {zh ? item.moderator.organization : ((item.moderator as any).organizationEn ?? item.moderator.organization)}</span>
                    )}
                  </div>
                )}

                {/* Speakers */}
                {item.speakers.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {item.speakers.map((sl) => (
                      <div key={sl.id} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        {sl.speaker.avatar
                          ? <img alt={sl.speaker.name} src={sl.speaker.avatar} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                          : <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#e5e7eb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "var(--cp-fs-12)" }}>👤</span>
                        }
                        <span style={{ fontSize: "var(--cp-text-small)", color: "#374151" }}>
                          {zh ? sl.speaker.name : (sl.speaker.nameEn ?? sl.speaker.name)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
