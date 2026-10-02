## apps/passport-web/components/locale-switcher.tsx
```.tsx
"use client";

import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import type { Locale } from "@/lib/site-content";

const LOCALE_OPTIONS = [
  { code: "zh" as const, flag: "🇨🇳", label: "中文" },
  { code: "en" as const, flag: "🇬🇧", label: "English" },
  { code: "fr" as const, flag: "🇫🇷", label: "Français" },
  { code: "de" as const, flag: "🇩🇪", label: "Deutsch" },
];

const LOCALE_SWITCH_PRESERVE_STORAGE_KEY = "locale-switch-preserve-path-v1";

function getLocaleIndependentPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const knownLocales = new Set(["en", "zh", "fr", "de"]);
  const tail = knownLocales.has(segments[0]) ? segments.slice(1) : segments;
  return `/${tail.join("/")}`;
}

export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Extract tail path (everything after the locale segment)
  const segments = pathname.split("/").filter(Boolean);
  const knownLocales = new Set(["en", "zh", "fr", "de"]);
  const tail = knownLocales.has(segments[0]) ? segments.slice(1) : segments;

  const current = LOCALE_OPTIONS.find((l) => l.code === locale) ?? LOCALE_OPTIONS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function markLocaleSwitchPreserve() {
    try {
      window.sessionStorage.setItem(LOCALE_SWITCH_PRESERVE_STORAGE_KEY, getLocaleIndependentPath(pathname));
    } catch {
      // Ignore storage write errors.
    }
  }

  return (
    <div className="locale-switcher" ref={ref} aria-label={label}>
      <button
        className="locale-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        type="button"
      >
        <span className="locale-flag" aria-hidden="true">{current.flag}</span>
        <span className="locale-name">{current.label}</span>
        <span className="locale-chevron" aria-hidden="true" data-open={open}>▾</span>
      </button>

      {open && (
        <ul className="locale-dropdown" role="listbox" aria-label={label}>
          {LOCALE_OPTIONS.map((opt) => {
            const href = `/${opt.code}${tail.length ? `/${tail.join("/")}` : ""}`;
            return (
              <li
                key={opt.code}
                role="option"
                aria-selected={opt.code === locale}
                className={opt.code === locale ? "locale-option locale-option-active" : "locale-option"}
              >
                <a href={href} onClick={() => { markLocaleSwitchPreserve(); setOpen(false); }}>
                  <span className="locale-flag" aria-hidden="true">{opt.flag}</span>
                  <span className="locale-name">{opt.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

```
## apps/passport-web/components/activity-poster-buttons.tsx
```.tsx
"use client";

import { useState } from "react";
import { buildSharePoster, buildEventPoster } from "./activity-poster-canvas";

type PosterActivity = {
  title: string;
  titleEn?: string | null;
  subtitle?: string | null;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
  locationJson?: Record<string, string> | null;
  organizerName?: string | null;
  posterImage?: string | null;
  slug: string;
  locale: string;
};

export function ActivityPosterButtons({ activity, locale }: { activity: PosterActivity; locale: string }) {
  const [generatingShare, setGeneratingShare] = useState(false);
  const [generatingEvent, setGeneratingEvent] = useState(false);
  const zh = locale === "zh";

  const loc = activity.locationJson ?? {};
  const venue = zh ? (loc.venue ?? loc.name) : (loc.venueEn ?? loc.nameEn ?? loc.venue ?? loc.name);
  const city = zh ? loc.city : (loc.cityEn ?? loc.city);
  const address = zh ? loc.address : (loc.addressEn ?? loc.address);

  async function handleSharePoster() {
    setGeneratingShare(true);
    try {
      const dataUrl = await buildSharePoster({
        title: activity.title,
        titleEn: activity.titleEn,
        startTime: activity.startTime,
        endTime: activity.endTime,
        timezone: activity.timezone,
        venue,
        city,
        address,
        organizerName: activity.organizerName,
        posterImage: activity.posterImage,
        slug: activity.slug,
        locale,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${activity.slug}_share.png`;
      link.click();
    } catch (e) {
      console.error("Share poster error:", e);
      alert(zh ? "生成海报失败" : "Failed to generate poster");
    } finally {
      setGeneratingShare(false);
    }
  }

  async function handleEventPoster() {
    setGeneratingEvent(true);
    try {
      const dataUrl = await buildEventPoster({
        title: activity.title,
        titleEn: activity.titleEn,
        startTime: activity.startTime,
        endTime: activity.endTime,
        timezone: activity.timezone,
        venue,
        city,
        address,
        organizerName: activity.organizerName,
        posterImage: activity.posterImage,
        slug: activity.slug,
        locale,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${activity.slug}_poster.png`;
      link.click();
    } catch (e) {
      console.error("Event poster error:", e);
      alert(zh ? "生成海报失败" : "Failed to generate poster");
    } finally {
      setGeneratingEvent(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
      <button
        className="button button button-secondary"
        disabled={generatingShare}
        onClick={handleSharePoster}
        type="button"
      >
        {generatingShare ? (zh ? "生成中…" : "Generating…") : (zh ? "📱 分享海报" : "📱 Share Poster")}
      </button>
      <button
        className="button button button-secondary"
        disabled={generatingEvent}
        onClick={handleEventPoster}
        type="button"
      >
        {generatingEvent ? (zh ? "生成中…" : "Generating…") : (zh ? "🖼️ 活动海报" : "🖼️ Event Poster")}
      </button>
    </div>
  );
}

```