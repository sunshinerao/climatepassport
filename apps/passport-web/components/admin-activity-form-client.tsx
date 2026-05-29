"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/site-content";

const ACTIVITY_TYPES = ["EVENT", "LEARNING", "CHALLENGE", "PROJECT", "TASK", "COURSE"] as const;
const LOCATION_TYPES = ["ONLINE", "OFFLINE", "HYBRID"] as const;
const VISIBILITY_OPTIONS = ["PUBLIC", "PRIVATE", "UNLISTED", "INVITE_ONLY"] as const;
const EVENT_LAYERS = ["INSTITUTION", "ECONOMY", "ROOT", "ACCELERATOR", "COMPREHENSIVE"] as const;
const HOST_TYPES = ["OFFICIAL", "CO_HOSTED", "REGISTERED", "SIDE_EVENT", "COMMUNITY"] as const;

const TYPE_LABELS_ZH: Record<string, string> = {
  EVENT: "活动", LEARNING: "学习", CHALLENGE: "挑战", PROJECT: "项目", TASK: "任务", COURSE: "课程",
};
const EVENT_LAYER_LABELS_ZH: Record<string, string> = {
  INSTITUTION: "机构级", ECONOMY: "经济体级", ROOT: "主办", ACCELERATOR: "加速器", COMPREHENSIVE: "综合",
};
const HOST_TYPE_LABELS_ZH: Record<string, string> = {
  OFFICIAL: "官方活动", CO_HOSTED: "联合主办", REGISTERED: "注册活动", SIDE_EVENT: "边会", COMMUNITY: "社区活动",
};

export function AdminActivityFormClient({
  locale,
  userId,
  mode,
  initial,
}: {
  locale: Locale;
  userId: string;
  mode: "create" | "edit";
  initial?: Record<string, any>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse locationJson for venue/address/city
  const locJson = initial?.locationJson as Record<string, string> | null | undefined;

  const [form, setForm] = useState({
    type: initial?.type ?? "EVENT",
    title: initial?.title ?? "",
    titleEn: initial?.titleEn ?? "",
    subtitle: initial?.subtitle ?? "",
    slug: initial?.slug ?? "",
    category: initial?.category ?? "",
    summary: initial?.summary ?? "",
    description: initial?.description ?? "",
    organizerName: initial?.organizerName ?? "",
    startTime: initial?.startTime ? initial.startTime.slice(0, 16) : "",
    endTime: initial?.endTime ? initial.endTime.slice(0, 16) : "",
    timezone: initial?.timezone ?? "Asia/Shanghai",
    locationType: initial?.locationType ?? "ONLINE",
    onlineUrl: initial?.onlineUrl ?? "",
    // Venue / address fields → stored in locationJson
    venueZh: locJson?.venue ?? "",
    venueEn: locJson?.venueEn ?? "",
    addressZh: locJson?.address ?? "",
    addressEn: locJson?.addressEn ?? "",
    cityZh: locJson?.city ?? "",
    cityEn: locJson?.cityEn ?? "",
    roomZh: locJson?.room ?? "",
    status: initial?.status ?? "DRAFT",
    visibility: initial?.visibility ?? "PUBLIC",
    capacity: initial?.capacity?.toString() ?? "",
    registrationOpenAt: initial?.registrationOpenAt ? initial.registrationOpenAt.slice(0, 16) : "",
    registrationCloseAt: initial?.registrationCloseAt ? initial.registrationCloseAt.slice(0, 16) : "",
    requiresApproval: initial?.requiresApproval ?? false,
    isFeatured: initial?.isFeatured ?? false,
    language: initial?.language ?? "zh",
    tags: initial?.tags?.join(", ") ?? "",
    // EVENT-specific fields
    eventLayer: initial?.eventLayer ?? "",
    hostType: initial?.hostType ?? "",
    trackId: initial?.trackId ?? "",
    isPinned: initial?.isPinned ?? false,
    isPrivate: initial?.isPrivate ?? false,
    posterImage: initial?.posterImage ?? "",
    mapUrl: initial?.mapUrl ?? "",
    highlights: initial?.highlights ? JSON.stringify(initial.highlights, null, 2) : "",
    // Invitation content (EVENT only, stored in detail.configJson)
    invitationContentZh: initial?.invitationContentZh ?? "",
    invitationContentEn: initial?.invitationContentEn ?? "",
  });

  function set(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function autoSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Build locationJson from venue/address/city fields
      const locationJson = (form.locationType === "OFFLINE" || form.locationType === "HYBRID")
        ? {
            ...(form.venueZh && { venue: form.venueZh }),
            ...(form.venueEn && { venueEn: form.venueEn }),
            ...(form.addressZh && { address: form.addressZh }),
            ...(form.addressEn && { addressEn: form.addressEn }),
            ...(form.cityZh && { city: form.cityZh }),
            ...(form.cityEn && { cityEn: form.cityEn }),
            ...(form.roomZh && { room: form.roomZh }),
          }
        : undefined;

      const payload = {
        type: form.type,
        title: form.title,
        titleEn: form.titleEn || undefined,
        subtitle: form.subtitle || undefined,
        slug: form.slug || autoSlug(form.title),
        category: form.category || undefined,
        summary: form.summary || undefined,
        description: form.description || undefined,
        organizerName: form.organizerName || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        timezone: form.timezone,
        locationType: form.locationType,
        onlineUrl: form.onlineUrl || undefined,
        locationJson: locationJson ?? undefined,
        status: form.status,
        visibility: form.visibility,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        registrationOpenAt: form.registrationOpenAt || undefined,
        registrationCloseAt: form.registrationCloseAt || undefined,
        requiresApproval: form.requiresApproval,
        isFeatured: form.isFeatured,
        language: form.language,
        tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        eventLayer: form.eventLayer || undefined,
        hostType: form.hostType || undefined,
        trackId: form.trackId || undefined,
        isPinned: form.isPinned,
        isPrivate: form.isPrivate,
        posterImage: form.posterImage || undefined,
        mapUrl: form.mapUrl || undefined,
        highlights: form.highlights ? (() => { try { return JSON.parse(form.highlights); } catch { return undefined; } })() : undefined,
        createdByUserId: userId,
      };

      const url = mode === "create" ? "/api/activities" : `/api/activities/${initial?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save");
      }

      const activityId: string = data.activity.id;

      // If EVENT type with invitation content, save to detail API
      if (form.type === "EVENT" && (form.invitationContentZh || form.invitationContentEn)) {
        const detailRes = await fetch(`/api/activities/${activityId}/detail`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            configJson: {
              ...(form.invitationContentZh && { invitationContentZh: form.invitationContentZh }),
              ...(form.invitationContentEn && { invitationContentEn: form.invitationContentEn }),
            },
          }),
        });
        if (!detailRes.ok) {
          // Non-fatal: show warning but proceed
          setError(locale === "zh" ? "活动已保存，但邀请函内容保存失败" : "Activity saved, but invitation content failed to save");
        }
      }

      router.push(`/${locale}/admin/activities/${activityId}`);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {error && <div className="form-error form-error">{error}</div>}

      <fieldset className="form-grid">
        <legend>{locale === "zh" ? "基本信息" : "Basic Info"}</legend>

        <div className="field">
          <label className="label">{locale === "zh" ? "活动类型 *" : "Type *"}</label>
          <select className="field" required value={form.type} onChange={(e) => set("type", e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{locale === "zh" ? TYPE_LABELS_ZH[t] : t}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">{locale === "zh" ? "标题（中文）*" : "Title (ZH) *"}</label>
          <input
            className="field"
            required
            type="text"
            value={form.title}
            onChange={(e) => {
              set("title", e.target.value);
              if (mode === "create" && !form.slug) set("slug", autoSlug(e.target.value));
            }}
          />
        </div>

        <div className="field">
          <label className="label">{locale === "zh" ? "标题（英文）" : "Title (EN)"}</label>
          <input className="field" type="text" value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} />
        </div>

        <div className="field">
          <label className="label">Slug *</label>
          <input
            className="field"
            placeholder="url-friendly-slug"
            required
            type="text"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label">{locale === "zh" ? "副标题" : "Subtitle"}</label>
          <input className="field" type="text" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
        </div>

        <div className="field">
          <label className="label">{locale === "zh" ? "分类标签" : "Category"}</label>
          <input className="field" type="text" value={form.category} onChange={(e) => set("category", e.target.value)} />
        </div>

        <div className="field">
          <label className="label">{locale === "zh" ? "组织方名称" : "Organizer Name"}</label>
          <input className="field" type="text" value={form.organizerName} onChange={(e) => set("organizerName", e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="form-grid">
        <legend>{locale === "zh" ? "时间与地点" : "Time & Location"}</legend>

        <div className="field-row">
          <div className="field">
            <label className="label">{locale === "zh" ? "开始时间" : "Start Time"}</label>
            <input className="field" type="datetime-local" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </div>
          <div className="field">
            <label className="label">{locale === "zh" ? "结束时间" : "End Time"}</label>
            <input className="field" type="datetime-local" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="label">{locale === "zh" ? "时区" : "Timezone"}</label>
            <input className="field" type="text" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
          </div>
          <div className="field">
            <label className="label">{locale === "zh" ? "地点类型" : "Location Type"}</label>
            <select className="field" value={form.locationType} onChange={(e) => set("locationType", e.target.value)}>
              {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {(form.locationType === "ONLINE" || form.locationType === "HYBRID") && (
          <div className="field">
            <label className="label">{locale === "zh" ? "在线链接" : "Online URL"}</label>
            <input className="field" type="url" value={form.onlineUrl} onChange={(e) => set("onlineUrl", e.target.value)} />
          </div>
        )}

        {(form.locationType === "OFFLINE" || form.locationType === "HYBRID") && (
          <>
            <div className="field-row">
              <div className="field">
                <label className="label">{locale === "zh" ? "城市（中文）" : "City (ZH)"}</label>
                <input className="field" type="text" placeholder="上海" value={form.cityZh} onChange={(e) => set("cityZh", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">{locale === "zh" ? "城市（英文）" : "City (EN)"}</label>
                <input className="field" type="text" placeholder="Shanghai" value={form.cityEn} onChange={(e) => set("cityEn", e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label">{locale === "zh" ? "场馆名称（中文）" : "Venue (ZH)"}</label>
                <input className="field" type="text" value={form.venueZh} onChange={(e) => set("venueZh", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">{locale === "zh" ? "场馆名称（英文）" : "Venue (EN)"}</label>
                <input className="field" type="text" value={form.venueEn} onChange={(e) => set("venueEn", e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label">{locale === "zh" ? "详细地址（中文）" : "Address (ZH)"}</label>
                <input className="field" type="text" value={form.addressZh} onChange={(e) => set("addressZh", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">{locale === "zh" ? "详细地址（英文）" : "Address (EN)"}</label>
                <input className="field" type="text" value={form.addressEn} onChange={(e) => set("addressEn", e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="label">{locale === "zh" ? "房间号 / 楼层" : "Room / Floor"}</label>
              <input className="field" type="text" placeholder={locale === "zh" ? "如：2楼多功能厅" : "e.g. 2F Ballroom"} value={form.roomZh} onChange={(e) => set("roomZh", e.target.value)} />
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="form-grid">
        <legend>{locale === "zh" ? "报名设置" : "Registration Settings"}</legend>

        <div className="field-row">
          <div className="field">
            <label className="label">{locale === "zh" ? "报名开放时间" : "Registration Opens"}</label>
            <input className="field" type="datetime-local" value={form.registrationOpenAt} onChange={(e) => set("registrationOpenAt", e.target.value)} />
          </div>
          <div className="field">
            <label className="label">{locale === "zh" ? "报名截止时间" : "Registration Closes"}</label>
            <input className="field" type="datetime-local" value={form.registrationCloseAt} onChange={(e) => set("registrationCloseAt", e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="label">{locale === "zh" ? "人数限制" : "Capacity"}</label>
            <input
              className="field"
              min={0}
              placeholder={locale === "zh" ? "留空表示不限" : "Leave empty for unlimited"}
              type="number"
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">{locale === "zh" ? "可见性" : "Visibility"}</label>
            <select className="field" value={form.visibility} onChange={(e) => set("visibility", e.target.value)}>
              {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="field field">
          <label>
            <input checked={form.requiresApproval} type="checkbox" onChange={(e) => set("requiresApproval", e.target.checked)} />
            {locale === "zh" ? " 需要审核报名" : " Requires approval"}
          </label>
        </div>

        <div className="field field">
          <label>
            <input checked={form.isFeatured} type="checkbox" onChange={(e) => set("isFeatured", e.target.checked)} />
            {locale === "zh" ? " 设为精选活动" : " Featured activity"}
          </label>
        </div>
      </fieldset>

      {form.type === "EVENT" && (
        <fieldset className="form-grid">
          <legend>{locale === "zh" ? "活动专项设置" : "Event Settings"}</legend>

          <div className="field-row">
            <div className="field">
              <label className="label">{locale === "zh" ? "活动层级" : "Event Layer"}</label>
              <select className="field" value={form.eventLayer} onChange={(e) => set("eventLayer", e.target.value)}>
                <option value="">{locale === "zh" ? "（不设置）" : "(none)"}</option>
                {EVENT_LAYERS.map((l) => (
                  <option key={l} value={l}>{locale === "zh" ? EVENT_LAYER_LABELS_ZH[l] : l}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">{locale === "zh" ? "主办类型" : "Host Type"}</label>
              <select className="field" value={form.hostType} onChange={(e) => set("hostType", e.target.value)}>
                <option value="">{locale === "zh" ? "（不设置）" : "(none)"}</option>
                {HOST_TYPES.map((h) => (
                  <option key={h} value={h}>{locale === "zh" ? HOST_TYPE_LABELS_ZH[h] : h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label">{locale === "zh" ? "所属主题 (Track ID)" : "Track ID"}</label>
            <input className="field" type="text" value={form.trackId} onChange={(e) => set("trackId", e.target.value)} />
          </div>

          <div className="field">
            <label className="label">{locale === "zh" ? "活动海报图片 URL" : "Poster Image URL"}</label>
            <input className="field" type="url" placeholder="https://…" value={form.posterImage} onChange={(e) => set("posterImage", e.target.value)} />
          </div>

          <div className="field">
            <label className="label">{locale === "zh" ? "地图 URL（可嵌入）" : "Map URL (embeddable)"}</label>
            <input className="field" type="url" placeholder="https://maps.google.com/…" value={form.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} />
          </div>

          <div className="field">
            <label className="label">{locale === "zh" ? "活动亮点（JSON数组，每项为字符串）" : "Highlights (JSON array of strings)"}</label>
            <textarea
              className="field"
              placeholder={'["亮点1", "亮点2"]'}
              rows={4}
              value={form.highlights}
              onChange={(e) => set("highlights", e.target.value)}
            />
          </div>

          <div className="field field">
            <label>
              <input checked={form.isPinned} type="checkbox" onChange={(e) => set("isPinned", e.target.checked)} />
              {locale === "zh" ? " 置顶显示" : " Pin to top"}
            </label>
          </div>

          <div className="field field">
            <label>
              <input checked={form.isPrivate} type="checkbox" onChange={(e) => set("isPrivate", e.target.checked)} />
              {locale === "zh" ? " 闭门会（仅受邀者可参与）" : " Closed-door event (invite-only)"}
            </label>
          </div>

          <hr style={{ margin: "1rem 0", borderColor: "var(--color-border)" }} />
          <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
            {locale === "zh" ? "邀请函正文内容（HTML，可嵌入邀请邮件）" : "Invitation content (HTML, used in invitation emails)"}
          </p>

          <div className="field">
            <label className="label">{locale === "zh" ? "邀请函（中文）" : "Invitation Content (ZH)"}</label>
            <textarea
              className="field"
              placeholder={locale === "zh" ? "<p>尊敬的嘉宾，诚邀您参加…</p>" : "<p>Dear guest, you are invited to…</p>"}
              rows={6}
              value={form.invitationContentZh}
              onChange={(e) => set("invitationContentZh", e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">{locale === "zh" ? "邀请函（英文）" : "Invitation Content (EN)"}</label>
            <textarea
              className="field"
              placeholder="<p>Dear guest, you are cordially invited to…</p>"
              rows={6}
              value={form.invitationContentEn}
              onChange={(e) => set("invitationContentEn", e.target.value)}
            />
          </div>
        </fieldset>
      )}

      <fieldset className="form-grid">
        <legend>{locale === "zh" ? "描述与标签" : "Description & Tags"}</legend>

        <div className="field">
          <label className="label">{locale === "zh" ? "摘要" : "Summary"}</label>
          <textarea className="field" rows={3} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
        </div>

        <div className="field">
          <label className="label">{locale === "zh" ? "详细描述" : "Description"}</label>
          <textarea className="field" rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        <div className="field">
          <label className="label">{locale === "zh" ? "标签（逗号分隔）" : "Tags (comma-separated)"}</label>
          <input className="field" type="text" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
        </div>
      </fieldset>

      <div className="button-row">
        <button className="button button-secondary" disabled={saving} type="button" onClick={() => router.back()}>
          {locale === "zh" ? "取消" : "Cancel"}
        </button>
        <button className="button button" disabled={saving} type="submit">
          {saving
            ? locale === "zh" ? "保存中…" : "Saving…"
            : mode === "create"
            ? locale === "zh" ? "创建活动" : "Create Activity"
            : locale === "zh" ? "保存修改" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
