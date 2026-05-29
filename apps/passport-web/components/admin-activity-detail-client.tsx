"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/site-content";

type ActivityDetailData = {
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
  onlineUrl: string | null;
  organizerName: string | null;
  isFeatured: boolean;
  capacity: number | null;
  requiresApproval: boolean;
  language: string;
  tags: string[];
  createdAt: string;
  _count: {
    applications: number;
    participations: number;
    checkinRecords: number;
    submissions: number;
  };
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "chip cpca-badge cpca-badge-gray",
  PUBLISHED: "chip cpca-badge cpca-badge-blue",
  ONGOING: "chip cpca-badge cpca-badge-green",
  COMPLETED: "chip cpca-badge cpca-badge-blue",
  CANCELLED: "chip cpca-badge cpca-badge-red",
  ARCHIVED: "chip cpca-badge cpca-badge-gray",
};

const NEXT_STATUSES: Record<string, { value: string; label: string; labelEn: string }[]> = {
  DRAFT: [{ value: "PUBLISHED", label: "发布", labelEn: "Publish" }, { value: "CANCELLED", label: "取消", labelEn: "Cancel" }],
  PUBLISHED: [
    { value: "ONGOING", label: "开始进行", labelEn: "Set Ongoing" },
    { value: "CANCELLED", label: "取消", labelEn: "Cancel" },
    { value: "ARCHIVED", label: "归档", labelEn: "Archive" },
  ],
  ONGOING: [{ value: "COMPLETED", label: "标记完成", labelEn: "Mark Complete" }, { value: "CANCELLED", label: "取消", labelEn: "Cancel" }],
  COMPLETED: [{ value: "ARCHIVED", label: "归档", labelEn: "Archive" }],
  CANCELLED: [{ value: "ARCHIVED", label: "归档", labelEn: "Archive" }],
  ARCHIVED: [],
};

export function AdminActivityDetailClient({
  locale,
  activity,
}: {
  locale: Locale;
  activity: ActivityDetailData;
}) {
  const [currentStatus, setCurrentStatus] = useState(activity.status);
  const [transitioning, setTransitioning] = useState(false);

  async function changeStatus(newStatus: string) {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/activities/${activity.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCurrentStatus(newStatus);
      }
    } finally {
      setTransitioning(false);
    }
  }

  const nextActions = NEXT_STATUSES[currentStatus] ?? [];

  return (
    <div className="section">
      <div className="compact-header">
        <div>
          <span className={STATUS_COLORS[currentStatus] ?? "chip"}>{currentStatus}</span>
          {activity.isFeatured && <span className="chip cpca-badge cpca-badge-amber" style={{ marginLeft: "0.5rem" }}>{locale === "zh" ? "精选" : "Featured"}</span>}
          <h2 style={{ margin: "0.5rem 0 0.25rem" }}>{activity.title}</h2>
          {activity.titleEn && <p style={{ color: "var(--color-text-muted)", margin: 0 }}>{activity.titleEn}</p>}
          <code style={{ fontSize: "0.8em", color: "var(--color-text-muted)" }}>/{activity.slug}</code>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <Link className="button button-secondary button" href={`/${locale}/admin/activities/${activity.id}/edit`}>
            {locale === "zh" ? "编辑" : "Edit"}
          </Link>
          {nextActions.map((action) => (
            <button
              className="button button button-outline"
              disabled={transitioning}
              key={action.value}
              type="button"
              onClick={() => changeStatus(action.value)}
            >
              {locale === "zh" ? action.label : action.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="metric-grid">
        <div className="data-card">
          <span >{activity._count.applications}</span>
          <span >{locale === "zh" ? "报名申请" : "Applications"}</span>
        </div>
        <div className="data-card">
          <span >{activity._count.participations}</span>
          <span >{locale === "zh" ? "参与人数" : "Participations"}</span>
        </div>
        <div className="data-card">
          <span >{activity._count.checkinRecords}</span>
          <span >{locale === "zh" ? "签到记录" : "Check-ins"}</span>
        </div>
        <div className="data-card">
          <span >{activity._count.submissions}</span>
          <span >{locale === "zh" ? "作品提交" : "Submissions"}</span>
        </div>
      </div>

      <div className="split">
        <div className="section">
          <h3>{locale === "zh" ? "活动信息" : "Activity Info"}</h3>
          <dl >
            <dt>{locale === "zh" ? "类型" : "Type"}</dt>
            <dd>{activity.type}</dd>
            <dt>{locale === "zh" ? "可见性" : "Visibility"}</dt>
            <dd>{activity.visibility}</dd>
            <dt>{locale === "zh" ? "语言" : "Language"}</dt>
            <dd>{activity.language}</dd>
            {activity.organizerName && (
              <>
                <dt>{locale === "zh" ? "组织方" : "Organizer"}</dt>
                <dd>{activity.organizerName}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="section">
          <h3>{locale === "zh" ? "时间与地点" : "Time & Location"}</h3>
          <dl >
            <dt>{locale === "zh" ? "开始时间" : "Start"}</dt>
            <dd>{activity.startTime ? new Date(activity.startTime).toLocaleString(locale === "zh" ? "zh-CN" : "en-US") : "—"}</dd>
            <dt>{locale === "zh" ? "结束时间" : "End"}</dt>
            <dd>{activity.endTime ? new Date(activity.endTime).toLocaleString(locale === "zh" ? "zh-CN" : "en-US") : "—"}</dd>
            <dt>{locale === "zh" ? "地点类型" : "Location"}</dt>
            <dd>{activity.locationType ?? "—"}</dd>
            {activity.onlineUrl && (
              <>
                <dt>{locale === "zh" ? "在线链接" : "Online URL"}</dt>
                <dd><a href={activity.onlineUrl} rel="noopener noreferrer" target="_blank">{activity.onlineUrl}</a></dd>
              </>
            )}
          </dl>
        </div>

        <div className="section">
          <h3>{locale === "zh" ? "报名设置" : "Registration"}</h3>
          <dl >
            <dt>{locale === "zh" ? "人数限制" : "Capacity"}</dt>
            <dd>{activity.capacity ?? (locale === "zh" ? "不限" : "Unlimited")}</dd>
            <dt>{locale === "zh" ? "需要审核" : "Requires Approval"}</dt>
            <dd>{activity.requiresApproval ? (locale === "zh" ? "是" : "Yes") : (locale === "zh" ? "否" : "No")}</dd>
          </dl>
        </div>
      </div>

      {activity.tags.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <strong>{locale === "zh" ? "标签：" : "Tags: "}</strong>
          {activity.tags.map((tag) => (
            <span className="chip chip" key={tag} style={{ marginRight: "0.25rem" }}>{tag}</span>
          ))}
        </div>
      )}

      <div  style={{ marginTop: "1.5rem" }}>
        {/* Common management links */}
        <Link href={`/${locale}/admin/activities/${activity.id}/applications`}>{locale === "zh" ? "→ 报名审核" : "→ Applications"}</Link>
        <Link href={`/${locale}/admin/activities/${activity.id}/participations`}>{locale === "zh" ? "→ 参与管理" : "→ Participations"}</Link>
        <Link href={`/${locale}/admin/activities/${activity.id}/checkin`}>{locale === "zh" ? "→ 签到记录" : "→ Check-ins"}</Link>
        {/* EVENT-specific links */}
        {activity.type === "EVENT" && (
          <>
            <Link href={`/${locale}/admin/activities/${activity.id}/agenda`}>{locale === "zh" ? "→ 活动议程" : "→ Agenda"}</Link>
            <Link href={`/${locale}/admin/activities/${activity.id}/speakers`}>{locale === "zh" ? "→ 嘉宾管理" : "→ Speakers"}</Link>
            <Link href={`/${locale}/activities/${activity.slug}/checkin-poster`}>{locale === "zh" ? "→ 签到海报" : "→ Check-in Poster"}</Link>
            <Link href={`/${locale}/activities/${activity.slug}/poster`}>{locale === "zh" ? "→ 活动海报" : "→ Activity Poster"}</Link>
          </>
        )}
        {/* PROJECT-specific links */}
        {activity.type === "PROJECT" && (
          <>
            <Link href={`/${locale}/admin/activities/${activity.id}/milestones`}>{locale === "zh" ? "→ 项目里程碑" : "→ Milestones"}</Link>
            <Link href={`/${locale}/admin/activities/${activity.id}/submissions`}>{locale === "zh" ? "→ 成果提交" : "→ Submissions"}</Link>
          </>
        )}
        {/* CHALLENGE-specific links */}
        {activity.type === "CHALLENGE" && (
          <>
            <Link href={`/${locale}/activities/${activity.slug}/leaderboard`}>{locale === "zh" ? "→ 排行榜" : "→ Leaderboard"}</Link>
            <Link href={`/${locale}/admin/activities/${activity.id}/submissions`}>{locale === "zh" ? "→ 作品审核" : "→ Submissions"}</Link>
          </>
        )}
        {/* LEARNING-specific links */}
        {activity.type === "LEARNING" && (
          <>
            <Link href={`/${locale}/admin/activities/${activity.id}/tasks`}>{locale === "zh" ? "→ 学习任务" : "→ Tasks"}</Link>
            <Link href={`/${locale}/admin/activities/${activity.id}/submissions`}>{locale === "zh" ? "→ 作品审核" : "→ Submissions"}</Link>
          </>
        )}
        {/* TASK/COURSE generic task management */}
        {(activity.type === "TASK" || activity.type === "COURSE") && (
          <Link href={`/${locale}/admin/activities/${activity.id}/tasks`}>{locale === "zh" ? "→ 任务管理" : "→ Tasks"}</Link>
        )}
        {/* Analytics always shown */}
        <Link href={`/${locale}/admin/activities/${activity.id}/rewards`}>{locale === "zh" ? "→ 奖励规则" : "→ Reward Rules"}</Link>
        <Link href={`/${locale}/admin/activities/${activity.id}/analytics`}>{locale === "zh" ? "→ 数据分析" : "→ Analytics"}</Link>
      </div>
    </div>
  );
}
