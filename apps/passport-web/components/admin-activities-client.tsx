"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/site-content";

/* ── Types ── */
type ActivityRow = {
  id: string;
  type: string;
  title: string;
  titleEn: string | null;
  slug: string;
  status: string;
  visibility: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  locationType: string | null;
  locationJson: any;
  onlineUrl: string | null;
  isFeatured: boolean;
  isPinned: boolean;
  isPrivate: boolean;
  capacity: number | null;
  description: string | null;
  descriptionEn: string | null;
  createdAt: string;
  _count: {
    applications: number;
    participations: number;
  };
};

type Stats = {
  total: number;
  published: number;
  draft: number;
  ongoing: number;
  completed: number;
  archived: number;
};

/* ── Constants ── */
const STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  DRAFT:     { zh: "草稿",    en: "Draft" },
  PUBLISHED: { zh: "已发布",  en: "Published" },
  ONGOING:   { zh: "进行中",  en: "Ongoing" },
  COMPLETED: { zh: "已完成",  en: "Completed" },
  CANCELLED: { zh: "已取消",  en: "Cancelled" },
  ARCHIVED:  { zh: "已归档",  en: "Archived" },
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT:     "admin-status-draft",
  PUBLISHED: "admin-status-published",
  ONGOING:   "admin-status-ongoing",
  COMPLETED: "admin-status-completed",
  CANCELLED: "admin-status-cancelled",
  ARCHIVED:  "admin-status-archived",
};

const TYPE_META: Record<string, { zhLabel: string; enLabel: string }> = {
  EVENT:     { zhLabel: "活动",         enLabel: "Events" },
  LEARNING:  { zhLabel: "学习体验",     enLabel: "Learning Experiences" },
  CHALLENGE: { zhLabel: "挑战行动",     enLabel: "Challenges" },
  TASK:      { zhLabel: "任务",         enLabel: "Tasks" },
  PROJECT:   { zhLabel: "项目孵化",     enLabel: "Projects" },
  COURSE:    { zhLabel: "课程",         enLabel: "Courses" },
};

const CAT_CLASS: Record<string, string> = {
  EVENT: "cat-event",
  LEARNING: "cat-learning",
  CHALLENGE: "cat-challenge",
  TASK: "cat-task",
  PROJECT: "cat-project",
  COURSE: "cat-course",
};

/* ── Icons ── */
function IconCalendar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconLocation({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconUsers({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    </svg>
  );
}

function IconSearch({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconEdit({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconInfo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconEye({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconUsersCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

function IconMail({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconStar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconPlus({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconEvent({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconBook({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function IconZap({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconCheckSquare({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconFolder({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconGraduation({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}

const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  EVENT: IconEvent,
  LEARNING: IconBook,
  CHALLENGE: IconZap,
  TASK: IconCheckSquare,
  PROJECT: IconFolder,
  COURSE: IconGraduation,
};

/* ── Helpers ── */
function formatDateRange(start: string | null, end: string | null, tz: string, zh: boolean): string {
  if (!start) return zh ? "TBD" : "TBD";
  const s = new Date(start);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const startStr = s.toLocaleDateString(zh ? "zh-CN" : "en-US", options);
  if (!end) return startStr;
  const e = new Date(end);
  const endStr = e.toLocaleDateString(zh ? "zh-CN" : "en-US", options);
  if (startStr === endStr) return startStr;
  return `${startStr} – ${endStr}`;
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(start);
  const sh = String(s.getHours()).padStart(2, "0");
  const sm = String(s.getMinutes()).padStart(2, "0");
  if (!end) return `${sh}:${sm}`;
  const e = new Date(end);
  const eh = String(e.getHours()).padStart(2, "0");
  const em = String(e.getMinutes()).padStart(2, "0");
  return `${sh}:${sm}–${eh}:${em}`;
}

/* ── Export CSV helper ── */
function exportCSV(activities: ActivityRow[], zh: boolean) {
  const headers = zh
    ? ["ID", "类型", "标题", "英文标题", "状态", "可见性", "开始时间", "结束时间", "地点", "容量", "申请数", "参与数", "创建时间"]
    : ["ID", "Type", "Title", "Title EN", "Status", "Visibility", "Start", "End", "Location", "Capacity", "Applications", "Participations", "Created"];
  const rows = activities.map((a) => [
    a.id,
    a.type,
    a.title,
    a.titleEn ?? "",
    a.status,
    a.visibility,
    a.startTime ?? "",
    a.endTime ?? "",
    a.locationType ?? "",
    a.capacity ?? "",
    a._count.applications,
    a._count.participations,
    a.createdAt,
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activities_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main component ── */
export function AdminActivitiesClient({
  locale,
  activities,
  grouped,
  stats,
  typeMeta,
  typeOrder,
}: {
  locale: Locale;
  activities: ActivityRow[];
  grouped: Record<string, ActivityRow[]>;
  stats: Stats;
  typeMeta: Record<string, { zhLabel: string; enLabel: string }>;
  typeOrder: string[];
}) {
  const router = useRouter();
  const zh = locale === "zh";

  const [searches, setSearches] = useState<Record<string, string>>({});
  const [sorts, setSorts] = useState<Record<string, string>>({});
  const [showCounts, setShowCounts] = useState<Record<string, number>>({});
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [visibilityMap, setVisibilityMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    activities.forEach((a) => { map[a.id] = a.visibility; });
    return map;
  });

  const statItems = [
    { key: "total",     value: stats.total,     label: zh ? "总计" : "Total" },
    { key: "published", value: stats.published, label: zh ? "已发布" : "Published" },
    { key: "draft",     value: stats.draft,     label: zh ? "草稿" : "Draft" },
    { key: "ongoing",   value: stats.ongoing,   label: zh ? "进行中" : "Ongoing" },
    { key: "completed", value: stats.completed, label: zh ? "已完成" : "Completed" },
    { key: "archived",  value: stats.archived,  label: zh ? "已归档" : "Archived" },
  ];

  async function handleDelete(id: string) {
    const a = activities.find((x) => x.id === id);
    const title = a?.title ?? id;
    if (!confirm(zh ? `确定要删除 "${title}" 吗？此操作不可撤销。` : `Are you sure you want to delete "${title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/activities/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      alert(zh ? "删除失败" : "Delete failed");
    }
  }

  async function handleVisibilityToggle(id: string) {
    const current = visibilityMap[id] ?? "PUBLIC";
    const next = current === "PUBLIC" ? "HIDDEN" : "PUBLIC";
    const res = await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: next }),
    });
    if (res.ok) {
      setVisibilityMap((m) => ({ ...m, [id]: next }));
    }
  }

  function toggleStar(id: string) {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getFilteredAndSorted(type: string) {
    const list = grouped[type] ?? [];
    const search = (searches[type] ?? "").toLowerCase().trim();
    let filtered = list;
    if (search) {
      filtered = list.filter(
        (a) =>
          a.title.toLowerCase().includes(search) ||
          (a.titleEn ?? "").toLowerCase().includes(search) ||
          (a.description ?? "").toLowerCase().includes(search) ||
          a.slug.toLowerCase().includes(search)
      );
    }
    const sort = sorts[type] ?? "newest";
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "status") return a.status.localeCompare(b.status);
      return 0;
    });
    return sorted;
  }

  return (
    <div className="admin-activities-content">
      {/* ── Page header ── */}
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h2>{zh ? "活动管理" : "Activities"}</h2>
          <p>
            {zh
              ? "按类型管理所有活动 — 活动、学习、挑战、项目、任务和课程。"
              : "Manage all activities across types — events, learning, challenges, projects, tasks, and courses."}
          </p>
        </div>
        <div className="admin-page-header-actions">
          <button className="button button-outline" onClick={() => exportCSV(activities, zh)}>
            {zh ? "导出 CSV" : "Export CSV"}
          </button>
          <Link className="button" href={`/${locale}/admin/activities/new`}>
            <IconPlus />
            {zh ? "创建活动" : "Create Activity"}
          </Link>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="admin-stats-strip">
        {statItems.map((s) => (
          <div className="admin-stat-chip" key={s.key}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Category sections ── */}
      {typeOrder.map((type) => {
        const list = grouped[type] ?? [];
        if (list.length === 0) return null;
        const meta = typeMeta[type] ?? { zhLabel: type, enLabel: type };
        const filtered = getFilteredAndSorted(type);
        const showCount = showCounts[type] ?? 3;
        const visibleCards = filtered.slice(0, showCount);
        const hasMore = filtered.length > showCount;
        const TypeIcon = TYPE_ICON[type] ?? IconEvent;
        const catClass = CAT_CLASS[type] ?? "";

        return (
          <div className={`admin-category-section ${catClass}`} key={type}>
            {/* Category header */}
            <div className="admin-category-header">
              <div className="admin-category-title">
                <div className="admin-category-icon">
                  <TypeIcon />
                </div>
                <h3>{zh ? meta.zhLabel : meta.enLabel}</h3>
                <span className="admin-category-count">
                  {filtered.length} {zh ? "个活动" : "activities"}
                </span>
              </div>
              <div className="admin-category-toolbar">
                <div className="admin-search-input">
                  <IconSearch />
                  <input
                    type="text"
                    placeholder={zh ? `搜索${meta.zhLabel}...` : `Search ${meta.enLabel.toLowerCase()}...`}
                    value={searches[type] ?? ""}
                    onChange={(e) => setSearches((s) => ({ ...s, [type]: e.target.value }))}
                  />
                </div>
                <select
                  className="admin-sort-select"
                  value={sorts[type] ?? "newest"}
                  onChange={(e) => setSorts((s) => ({ ...s, [type]: e.target.value }))}
                >
                  <option value="newest">{zh ? "最新优先" : "Newest first"}</option>
                  <option value="oldest">{zh ? "最早优先" : "Oldest first"}</option>
                  <option value="title">{zh ? "标题 A-Z" : "Title A-Z"}</option>
                  <option value="status">{zh ? "状态" : "Status"}</option>
                </select>
                <div className="admin-show-toggle">
                  {[3, 5, 10].map((n) => (
                    <button
                      key={n}
                      className={showCounts[type] === n || (showCounts[type] === undefined && n === 3) ? "active" : ""}
                      onClick={() => setShowCounts((c) => ({ ...c, [type]: n }))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Card grid */}
            <div className="admin-card-grid">
              {visibleCards.map((a) => {
                const isStarred = starredIds.has(a.id);
                const isVisible = (visibilityMap[a.id] ?? a.visibility) !== "HIDDEN";
                const desc = (zh ? a.description : a.descriptionEn) ?? a.description ?? "";
                const dateStr = formatDateRange(a.startTime, a.endTime, a.timezone, zh);
                const timeStr = formatTimeRange(a.startTime, a.endTime);
                const fullDate = timeStr ? `${dateStr} · ${timeStr}` : dateStr;
                const location = a.locationType
                  ? a.locationType
                  : a.onlineUrl
                  ? (zh ? "在线" : "Online")
                  : (zh ? "未设置地点" : "No location");
                const apps = a._count.applications;
                const parts = a._count.participations;
                const cap = a.capacity;

                return (
                  <div className={`admin-activity-card ${isStarred ? "is-starred" : ""}`} key={a.id}>
                    {/* Card top */}
                    <div className="admin-card-top">
                      <div className="admin-card-title">{a.title}</div>
                      <span className={`admin-card-status ${STATUS_CLASS[a.status] ?? ""}`}>
                        {STATUS_LABELS[a.status]?.[zh ? "zh" : "en"] ?? a.status}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="admin-card-meta">
                      <div className="admin-card-meta-item">
                        <IconCalendar />
                        {fullDate}
                      </div>
                      <div className="admin-card-meta-item">
                        <IconLocation />
                        {location}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="admin-card-tags">
                      <span className="admin-tag admin-tag-official">{zh ? "官方" : "Official"}</span>
                      {a.isFeatured ? <span className="admin-tag admin-tag-featured">{zh ? "精选" : "Featured"}</span> : null}
                      {a.isPrivate ? <span className="admin-tag admin-tag-invite">{zh ? "仅限邀请" : "Invite Only"}</span> : null}
                      {a.status === "ONGOING" ? <span className="admin-tag admin-tag-live">{zh ? "进行中" : "Live"}</span> : null}
                      {a.status === "COMPLETED" ? <span className="admin-tag admin-tag-ended">{zh ? "已结束" : "Ended"}</span> : null}
                      {a.status === "PUBLISHED" && new Date(a.startTime ?? Date.now()) > new Date() ? (
                        <span className="admin-tag admin-tag-new">{zh ? "即将开始" : "Upcoming"}</span>
                      ) : null}
                      {a.locationType === "HYBRID" ? <span className="admin-tag admin-tag-hybrid">{zh ? "混合" : "Hybrid"}</span> : null}
                      {a.locationType === "ONLINE" ? <span className="admin-tag admin-tag-online">{zh ? "在线" : "Online"}</span> : null}
                    </div>

                    {/* Description */}
                    {desc ? <div className="admin-card-desc">{desc}</div> : null}

                    {/* Footer */}
                    <div className="admin-card-footer">
                      <div className="admin-card-stats">
                        <IconUsers />
                        <span className="highlight">{apps + parts}</span>
                        {cap ? ` / ${cap}` : ""}
                      </div>
                      <div className="admin-card-actions">
                        <Link className="admin-action-btn" href={`/${locale}/admin/activities/${a.id}/edit`}>
                          <span className="admin-action-tooltip">{zh ? "编辑" : "Edit"}</span>
                          <IconEdit />
                        </Link>
                        <Link className="admin-action-btn" href={`/${locale}/admin/activities/${a.id}`}>
                          <span className="admin-action-tooltip">{zh ? "详情" : "Details"}</span>
                          <IconInfo />
                        </Link>
                        <button
                          className={`admin-action-btn ${isVisible ? "is-active" : "is-hidden"}`}
                          onClick={() => handleVisibilityToggle(a.id)}
                          type="button"
                        >
                          <span className="admin-action-tooltip">{isVisible ? (zh ? "可见" : "Visible") : (zh ? "隐藏" : "Hidden")}</span>
                          {isVisible ? <IconEye /> : <IconEyeOff />}
                        </button>
                        <Link className="admin-action-btn" href={`/${locale}/admin/activities/${a.id}/applications`}>
                          <span className="admin-action-tooltip">{zh ? "报名" : "Applications"}</span>
                          <IconUsersCheck />
                        </Link>
                        <Link className="admin-action-btn" href={`/${locale}/admin/activities/${a.id}`}>
                          <span className="admin-action-tooltip">{zh ? "邀请" : "Invitation"}</span>
                          <IconMail />
                        </Link>
                        <button
                          className={`admin-action-btn ${isStarred ? "is-star" : ""}`}
                          onClick={() => toggleStar(a.id)}
                          type="button"
                        >
                          <span className="admin-action-tooltip">{isStarred ? (zh ? "已收藏" : "Starred") : (zh ? "收藏" : "Star")}</span>
                          <IconStar />
                        </button>
                        <button
                          className="admin-action-btn is-danger"
                          onClick={() => handleDelete(a.id)}
                          type="button"
                        >
                          <span className="admin-action-tooltip">{zh ? "删除" : "Delete"}</span>
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show more */}
            {hasMore ? (
              <div className="admin-show-more">
                <button onClick={() => setShowCounts((c) => ({ ...c, [type]: filtered.length }))}>
                  {zh ? `查看全部 ${filtered.length} 个${meta.zhLabel} →` : `View all ${filtered.length} ${meta.enLabel.toLowerCase()} →`}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
