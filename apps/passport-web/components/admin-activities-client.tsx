"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/site-content";

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
  locationType: string | null;
  isFeatured: boolean;
  isPinned?: boolean;
  isPrivate?: boolean;
  eventLayer?: string | null;
  capacity: number | null;
  createdAt: string;
  _count: {
    applications: number;
    participations: number;
  };
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ONGOING: "进行中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  ARCHIVED: "已归档",
};

const TYPE_LABELS: Record<string, string> = {
  EVENT: "活动",
  LEARNING: "学习",
  CHALLENGE: "挑战",
  PROJECT: "项目",
  TASK: "任务",
  COURSE: "课程",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "chip cpca-badge cpca-badge-gray",
  PUBLISHED: "chip cpca-badge cpca-badge-blue",
  ONGOING: "chip cpca-badge cpca-badge-green",
  COMPLETED: "chip cpca-badge cpca-badge-blue",
  CANCELLED: "chip cpca-badge cpca-badge-red",
  ARCHIVED: "chip cpca-badge cpca-badge-gray",
};

const EVENT_LAYER_LABELS: Record<string, string> = {
  INSTITUTION: "机构级", ECONOMY: "经济体级", ROOT: "主办", ACCELERATOR: "加速器", COMPREHENSIVE: "综合",
};

const ALL_TABS = [
  { key: null,         zhLabel: "全部",     enLabel: "All" },
  { key: "EVENT",      zhLabel: "活动",     enLabel: "Events" },
  { key: "LEARNING",   zhLabel: "学习体验", enLabel: "Learning" },
  { key: "CHALLENGE",  zhLabel: "挑战行动", enLabel: "Challenges" },
  { key: "PROJECT",    zhLabel: "项目孵化", enLabel: "Projects" },
  { key: "COURSE",     zhLabel: "课程",     enLabel: "Courses" },
];

const CREATE_LABELS: Record<string, { zh: string; en: string }> = {
  EVENT:     { zh: "+ 创建活动",    en: "+ New Event" },
  LEARNING:  { zh: "+ 创建学习项目", en: "+ New Learning" },
  CHALLENGE: { zh: "+ 创建挑战",    en: "+ New Challenge" },
  PROJECT:   { zh: "+ 创建项目",    en: "+ New Project" },
  COURSE:    { zh: "+ 创建课程",    en: "+ New Course" },
};

export function AdminActivitiesClient({
  locale,
  activities,
  total,
  typeFilter,
}: {
  locale: Locale;
  activities: ActivityRow[];
  total: number;
  typeFilter?: string | null;
}) {
  const [search, setSearch] = useState("");
  const zh = locale === "zh";

  const filtered = activities.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.titleEn ?? "").toLowerCase().includes(search.toLowerCase()) ||
      a.slug.toLowerCase().includes(search.toLowerCase()),
  );

  const createHref = typeFilter
    ? `/${locale}/admin/activities/new?type=${typeFilter}`
    : `/${locale}/admin/activities/new`;
  const createLabel = typeFilter && CREATE_LABELS[typeFilter]
    ? (zh ? CREATE_LABELS[typeFilter].zh : CREATE_LABELS[typeFilter].en)
    : (zh ? "+ 创建活动" : "+ Create Activity");

  return (
    <div className="section">
      {/* Type tabs */}
      <div className="cert-admin-tabs" style={{ marginBottom: "1rem" }}>
        {ALL_TABS.map((tab) => (
          <Link
            key={tab.key ?? "all"}
            className={`cert-admin-tab${typeFilter === tab.key ? " cert-admin-tab active" : ""}`}
            href={tab.key ? `/${locale}/admin/activities?type=${tab.key}` : `/${locale}/admin/activities`}
          >
            {zh ? tab.zhLabel : tab.enLabel}
          </Link>
        ))}
      </div>

      <div >
        <input
          className="field"
          onChange={(e) => setSearch(e.target.value)}
          placeholder={zh ? "搜索标题或 slug…" : "Search title or slug…"}
          type="search"
          value={search}
        />
        <Link className="button button" href={createHref}>
          {createLabel}
        </Link>
      </div>

      <p >
        {zh ? `共 ${total} 条，显示 ${filtered.length} 条` : `${total} total, showing ${filtered.length}`}
      </p>

      <div >
        <table className="tableish">
          <thead>
            <tr>
              <th>{zh ? "标题" : "Title"}</th>
              {!typeFilter && <th>{zh ? "类型" : "Type"}</th>}
              <th>{zh ? "状态" : "Status"}</th>
              <th>{zh ? "开始时间" : "Start"}</th>
              {typeFilter === "EVENT" && <th>{zh ? "层级 / 属性" : "Layer / Tags"}</th>}
              <th>{zh ? "报名 / 参与" : "Apps / Parts"}</th>
              <th>{zh ? "操作" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={typeFilter === "EVENT" ? 7 : 6} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                  {zh ? "暂无数据" : "No items found"}
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      {a.isPinned && <span title={zh ? "已置顶" : "Pinned"} style={{ color: "#dc2626", fontSize: "0.8rem" }}>📌</span>}
                      {a.isFeatured && <span title={zh ? "精选" : "Featured"} style={{ color: "#d97706", fontSize: "0.8rem" }}>⭐</span>}
                      <span style={{ fontWeight: 600 }}>{a.title}</span>
                    </div>
                    {a.titleEn && <div style={{ fontSize: "0.82em", color: "var(--color-text-muted)" }}>{a.titleEn}</div>}
                    <div style={{ fontSize: "0.78em", color: "var(--color-text-muted)", fontFamily: "monospace" }}>/{a.slug}</div>
                  </td>
                  {!typeFilter && (
                    <td>
                      <span className="chip chip">{TYPE_LABELS[a.type] ?? a.type}</span>
                    </td>
                  )}
                  <td>
                    <span className={STATUS_COLORS[a.status] ?? "chip"}>{STATUS_LABELS[a.status] ?? a.status}</span>
                    {a.isPrivate && <span className="chip" style={{ marginLeft: "0.3rem", background: "#7c3aed", color: "#fff", fontSize: "0.7rem" }}>{zh ? "闭门" : "Closed"}</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {a.startTime ? new Date(a.startTime).toLocaleDateString(zh ? "zh-CN" : "en-US") : "—"}
                  </td>
                  {typeFilter === "EVENT" && (
                    <td>
                      {a.eventLayer && <span className="chip chip" style={{ fontSize: "0.7rem" }}>{EVENT_LAYER_LABELS[a.eventLayer] ?? a.eventLayer}</span>}
                    </td>
                  )}
                  <td>
                    {a._count.applications} / {a._count.participations}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link  href={`/${locale}/admin/activities/${a.id}`}>
                      {zh ? "详情" : "View"}
                    </Link>
                    {" · "}
                    <Link  href={`/${locale}/admin/activities/${a.id}/edit`}>
                      {zh ? "编辑" : "Edit"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
