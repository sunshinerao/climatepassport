"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/lib/site-content";

export type EventCard = {
  title: string;
  status: string;
  window: string;
  venue: string;
  category?: string | null;
};

type FilterDef = { key: string; label: string; match: (card: EventCard) => boolean };

export function EventsFilterableGrid({ cards, locale }: { cards: EventCard[]; locale: Locale }) {
  const isZh = locale === "zh";
  const filters = useMemo<FilterDef[]>(
    () => [
      { key: "all", label: isZh ? "全部" : "All", match: () => true },
      {
        key: "summit",
        label: isZh ? "峰会" : "Summit",
        match: (c) => /summit|峰会|大会/i.test(`${c.category ?? ""} ${c.title} ${c.status}`),
      },
      {
        key: "workshop",
        label: isZh ? "工作坊" : "Workshop",
        match: (c) => /workshop|工作坊|sprint|训练/i.test(`${c.category ?? ""} ${c.title} ${c.status}`),
      },
      {
        key: "online",
        label: isZh ? "线上" : "Online",
        match: (c) => /online|线上|virtual|webinar|直播/i.test(`${c.category ?? ""} ${c.venue} ${c.title}`),
      },
    ],
    [isZh],
  );

  const [activeKey, setActiveKey] = useState("all");
  const activeFilter = filters.find((f) => f.key === activeKey) ?? filters[0];
  const visible = cards.filter(activeFilter.match);

  return (
    <>
      <div className="proto-filter-row" role="tablist">
        {filters.map((f) => {
          const count = cards.filter(f.match).length;
          const isActive = f.key === activeKey;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? "filter-pill-active" : undefined}
              onClick={() => setActiveKey(f.key)}
            >
              {f.label}
              <span className="proto-filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      <section className="proto-events-grid">
        {visible.length === 0 ? (
          <p className="proto-dashboard-empty">{isZh ? "暂无符合该筛选的活动。" : "No events match this filter yet."}</p>
        ) : (
          visible.map((event, index) => (
            <article
              className={`proto-event-card${index === 0 && activeKey === "all" ? " is-featured" : ""}`}
              key={`${event.title}-${index}`}
            >
              <div className="proto-event-image" aria-hidden="true">
                <span className="proto-event-datebadge">{event.window.split(/[·,—-]/)[0]?.trim() || event.window}</span>
              </div>
              <div className="proto-event-body">
                <span className="status-badge">{event.status}</span>
                <h3>{event.title}</h3>
                <p>{event.window}</p>
                <div className="footer-note">{event.venue}</div>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
