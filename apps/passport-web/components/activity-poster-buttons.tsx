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
