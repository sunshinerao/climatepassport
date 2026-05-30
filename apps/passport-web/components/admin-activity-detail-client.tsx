"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminActivityAgendaClient } from "@/components/admin-activity-agenda-client";
import { AdminActivityInstitutionsClient } from "@/components/admin-activity-institutions-client";
import { AdminActivitySpeakersClient } from "@/components/admin-activity-speakers-client";
import { AdminActivityVerifiersClient } from "@/components/admin-activity-verifiers-client";
import { ActivityPosterButtons } from "@/components/activity-poster-buttons";
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
  isPinned?: boolean | null;
  isPrivate?: boolean | null;
  capacity: number | null;
  requiresApproval: boolean;
  language: string;
  timezone?: string | null;
  subtitle?: string | null;
  description?: string | null;
  locationJson?: Record<string, string> | null;
  posterImage?: string | null;
  mapUrl?: string | null;
  eventLayer?: string | null;
  hostType?: string | null;
  trackId?: string | null;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  tags: string[];
  createdAt: string;
  _count: {
    applications: number;
    participations: number;
    checkinRecords: number;
    submissions: number;
  };
};

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

type AgendaItemSpeaker = { id: string; order: number; speaker: Speaker };

type AgendaItem = {
  id: string;
  activityId: string;
  agendaDate: string;
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
  speakers: AgendaItemSpeaker[];
  order: number;
};

type ActivitySpeakerLink = {
  id: string;
  speakerId: string;
  activityId: string;
  role: string | null;
  roleEn: string | null;
  order: number;
  speaker: Speaker;
};

type UserOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type ActivityVerifier = {
  id: string;
  userId: string;
  activityId: string;
  createdAt: string;
  user: UserOption;
};

type InstitutionOption = {
  id: string;
  name: string;
  nameEn: string | null;
  logo: string | null;
  website: string | null;
};

type ActivityInstitutionLink = {
  id: string;
  institutionId: string;
  role: string | null;
  roleEn: string | null;
  showLogo: boolean;
  order: number;
  createdAt: string;
  institution: InstitutionOption;
};

const EVENT_LAYER_LABELS: Record<string, { zh: string; en: string }> = {
  INSTITUTION: { zh: "机构级", en: "Institution" },
  ECONOMY: { zh: "经济体级", en: "Economy" },
  ROOT: { zh: "主办", en: "Official" },
  ACCELERATOR: { zh: "加速器", en: "Accelerator" },
  COMPREHENSIVE: { zh: "综合", en: "Comprehensive" },
};

const HOST_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  OFFICIAL: { zh: "官方活动", en: "Official" },
  CO_HOSTED: { zh: "联合主办", en: "Co-hosted" },
  REGISTERED: { zh: "注册活动", en: "Registered" },
  SIDE_EVENT: { zh: "边会", en: "Side event" },
  COMMUNITY: { zh: "社区活动", en: "Community" },
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
  activityDetailConfig,
  agendaItems,
  allSpeakers,
  speakerLinks,
  verifiers,
  availableVerifiers,
  institutions,
  availableInstitutions,
}: {
  locale: Locale;
  activity: ActivityDetailData;
  activityDetailConfig?: Record<string, unknown> | null;
  agendaItems?: AgendaItem[];
  allSpeakers?: Speaker[];
  speakerLinks?: ActivitySpeakerLink[];
  verifiers?: ActivityVerifier[];
  availableVerifiers?: UserOption[];
  institutions?: ActivityInstitutionLink[];
  availableInstitutions?: InstitutionOption[];
}) {
  const [currentStatus, setCurrentStatus] = useState(activity.status);
  const [transitioning, setTransitioning] = useState(false);
  const zh = locale === "zh";
  const invitationContentZh = typeof activityDetailConfig?.invitationContentZh === "string" ? activityDetailConfig.invitationContentZh : "";
  const invitationContentEn = typeof activityDetailConfig?.invitationContentEn === "string" ? activityDetailConfig.invitationContentEn : "";

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
  const quickLinks = [
    { href: `/${locale}/admin/activities/${activity.id}/applications`, label: zh ? "报名审核" : "Applications", meta: `${activity._count.applications}` },
    { href: `/${locale}/admin/activities/${activity.id}/checkin`, label: zh ? "签到记录" : "Check-ins", meta: `${activity._count.checkinRecords}` },
    { href: `/${locale}/admin/activities/${activity.id}/participations`, label: zh ? "参与记录" : "Participations", meta: `${activity._count.participations}` },
    { href: `/${locale}/admin/activities/${activity.id}/rewards`, label: zh ? "奖励规则" : "Reward rules", meta: zh ? "积分 / 证书" : "Points / certificates" },
    { href: `/${locale}/admin/activities/${activity.id}/analytics`, label: zh ? "数据分析" : "Analytics", meta: zh ? "漏斗 / 趋势" : "Funnels / trends" },
  ];

  return (
    <div className="activity-admin-console">
      <section className="activity-console-hero panel">
        <div className="activity-console-copy">
          <div className="activity-console-badges">
            <span className={STATUS_COLORS[currentStatus] ?? "chip"}>{currentStatus}</span>
            {activity.isFeatured ? <span className="chip cpca-badge cpca-badge-amber">{zh ? "精选" : "Featured"}</span> : null}
            {activity.isPinned ? <span className="chip cpca-badge cpca-badge-red">{zh ? "置顶" : "Pinned"}</span> : null}
            {activity.isPrivate ? <span className="chip cpca-badge cpca-badge-gray">{zh ? "闭门" : "Private"}</span> : null}
          </div>
          <h2>{activity.title}</h2>
          {activity.titleEn ? <p>{activity.titleEn}</p> : null}
          <div className="activity-console-meta">
            <span>/{activity.slug}</span>
            <span>{activity.startTime ? new Date(activity.startTime).toLocaleString(zh ? "zh-CN" : "en-US") : "-"}</span>
            <span>{activity.locationType ?? (zh ? "待配置地点" : "Location pending")}</span>
          </div>
          {activity.description ? <div className="activity-console-summary">{activity.description}</div> : null}
        </div>
        <div className="activity-console-actions">
          <Link className="button button-secondary button" href={`/${locale}/admin/activities/${activity.id}/edit`}>
            {zh ? "编辑基础信息" : "Edit details"}
          </Link>
          {nextActions.map((action) => (
            <button
              className="button button button-outline"
              disabled={transitioning}
              key={action.value}
              type="button"
              onClick={() => changeStatus(action.value)}
            >
              {zh ? action.label : action.labelEn}
            </button>
          ))}
          {activity.type === "EVENT" ? (
            <>
              <Link className="button button-outline" href={`/${locale}/activities/${activity.slug}/checkin-poster`}>
                {zh ? "签到海报" : "Check-in poster"}
              </Link>
              <Link className="button button-outline" href={`/${locale}/activities/${activity.slug}/poster`}>
                {zh ? "公开海报页" : "Poster page"}
              </Link>
            </>
          ) : null}
        </div>
      </section>

      <section className="activity-console-stats">
        <div className="data-card activity-console-stat-card">
          <span>{activity._count.applications}</span>
          <span>{zh ? "报名申请" : "Applications"}</span>
        </div>
        <div className="data-card activity-console-stat-card">
          <span>{activity._count.participations}</span>
          <span>{zh ? "参与人数" : "Participations"}</span>
        </div>
        <div className="data-card activity-console-stat-card">
          <span>{activity._count.checkinRecords}</span>
          <span>{zh ? "签到记录" : "Check-ins"}</span>
        </div>
        <div className="data-card activity-console-stat-card">
          <span>{activity._count.submissions}</span>
          <span>{zh ? "作品提交" : "Submissions"}</span>
        </div>
      </section>

      <section className="activity-console-grid">
        <article className="panel activity-console-panel">
          <div className="activity-console-panel-head">
            <div>
              <span className="label">{zh ? "活动信息" : "Activity info"}</span>
              <h3>{zh ? "基础设定" : "Core setup"}</h3>
            </div>
          </div>
          <dl className="activity-console-dl">
            <dt>{zh ? "类型" : "Type"}</dt>
            <dd>{activity.type}</dd>
            <dt>{zh ? "可见性" : "Visibility"}</dt>
            <dd>{activity.visibility}</dd>
            <dt>{zh ? "语言" : "Language"}</dt>
            <dd>{activity.language}</dd>
            {activity.eventLayer ? <><dt>{zh ? "活动层级" : "Event layer"}</dt><dd>{(zh ? EVENT_LAYER_LABELS[activity.eventLayer]?.zh : EVENT_LAYER_LABELS[activity.eventLayer]?.en) ?? activity.eventLayer}</dd></> : null}
            {activity.hostType ? <><dt>{zh ? "主办属性" : "Host type"}</dt><dd>{(zh ? HOST_TYPE_LABELS[activity.hostType]?.zh : HOST_TYPE_LABELS[activity.hostType]?.en) ?? activity.hostType}</dd></> : null}
            {activity.trackId ? <><dt>{zh ? "Track ID" : "Track ID"}</dt><dd>{activity.trackId}</dd></> : null}
            {activity.organizerName && (
              <>
                <dt>{zh ? "组织方" : "Organizer"}</dt>
                <dd>{activity.organizerName}</dd>
              </>
            )}
          </dl>
        </article>

        <article className="panel activity-console-panel">
          <div className="activity-console-panel-head">
            <div>
              <span className="label">{zh ? "时间与地点" : "Time & location"}</span>
              <h3>{zh ? "现场信息" : "On-site info"}</h3>
            </div>
          </div>
          <dl className="activity-console-dl">
            <dt>{zh ? "开始时间" : "Start"}</dt>
            <dd>{activity.startTime ? new Date(activity.startTime).toLocaleString(zh ? "zh-CN" : "en-US") : "-"}</dd>
            <dt>{zh ? "结束时间" : "End"}</dt>
            <dd>{activity.endTime ? new Date(activity.endTime).toLocaleString(zh ? "zh-CN" : "en-US") : "-"}</dd>
            <dt>{zh ? "地点类型" : "Location"}</dt>
            <dd>{activity.locationType ?? "-"}</dd>
            {activity.onlineUrl && (
              <>
                <dt>{zh ? "在线链接" : "Online URL"}</dt>
                <dd><a href={activity.onlineUrl} rel="noopener noreferrer" target="_blank">{activity.onlineUrl}</a></dd>
              </>
            )}
            {activity.mapUrl ? <><dt>{zh ? "地图链接" : "Map URL"}</dt><dd><a href={activity.mapUrl} rel="noreferrer" target="_blank">{activity.mapUrl}</a></dd></> : null}
          </dl>
          {activity.type === "EVENT" ? <ActivityPosterButtons activity={{ ...activity, locale }} locale={locale} /> : null}
        </article>

        <article className="panel activity-console-panel">
          <div className="activity-console-panel-head">
            <div>
              <span className="label">{zh ? "报名设置" : "Registration"}</span>
              <h3>{zh ? "准入规则" : "Access rules"}</h3>
            </div>
          </div>
          <dl className="activity-console-dl">
            <dt>{zh ? "人数限制" : "Capacity"}</dt>
            <dd>{activity.capacity ?? (zh ? "不限" : "Unlimited")}</dd>
            <dt>{zh ? "需要审核" : "Requires approval"}</dt>
            <dd>{activity.requiresApproval ? (zh ? "是" : "Yes") : (zh ? "否" : "No")}</dd>
            <dt>{zh ? "报名开启" : "Registration opens"}</dt>
            <dd>{activity.registrationOpenAt ? new Date(activity.registrationOpenAt).toLocaleString(zh ? "zh-CN" : "en-US") : (zh ? "未设置" : "Not set")}</dd>
            <dt>{zh ? "报名截止" : "Registration closes"}</dt>
            <dd>{activity.registrationCloseAt ? new Date(activity.registrationCloseAt).toLocaleString(zh ? "zh-CN" : "en-US") : (zh ? "未设置" : "Not set")}</dd>
          </dl>
          {invitationContentZh || invitationContentEn ? (
            <div className="activity-console-note">
              {zh ? "邀请函内容已配置，可在编辑页继续调整。" : "Invitation copy is configured and can be refined from the edit page."}
            </div>
          ) : (
            <div className="activity-console-note is-muted">
              {zh ? "尚未配置邀请函文案。" : "Invitation copy has not been configured yet."}
            </div>
          )}
        </article>
      </section>

      {activity.tags.length > 0 && (
        <div className="activity-console-tags">
          <strong>{zh ? "标签" : "Tags"}</strong>
          {activity.tags.map((tag) => (
            <span className="chip chip" key={tag}>{tag}</span>
          ))}
        </div>
      )}

      <section className="activity-console-shortcuts panel">
        <div className="activity-console-panel-head">
          <div>
            <span className="label">{zh ? "快捷操作" : "Quick actions"}</span>
            <h3>{zh ? "运营入口" : "Operations"}</h3>
          </div>
        </div>
        <div className="activity-shortcut-grid">
          {quickLinks.map((item) => (
            <Link className="activity-shortcut-card" href={item.href} key={item.href}>
              <strong>{item.label}</strong>
              <span>{item.meta}</span>
            </Link>
          ))}
          {activity.type === "PROJECT" ? <Link className="activity-shortcut-card" href={`/${locale}/admin/activities/${activity.id}/milestones`}><strong>{zh ? "项目里程碑" : "Milestones"}</strong><span>{zh ? "阶段推进" : "Stage tracking"}</span></Link> : null}
          {activity.type === "CHALLENGE" ? <Link className="activity-shortcut-card" href={`/${locale}/activities/${activity.slug}/leaderboard`}><strong>{zh ? "排行榜" : "Leaderboard"}</strong><span>{zh ? "公开排名" : "Public ranking"}</span></Link> : null}
          {activity.type === "LEARNING" || activity.type === "TASK" || activity.type === "COURSE" ? <Link className="activity-shortcut-card" href={`/${locale}/admin/activities/${activity.id}/tasks`}><strong>{zh ? "任务配置" : "Tasks"}</strong><span>{zh ? "学习任务" : "Learning tasks"}</span></Link> : null}
          {activity.type === "PROJECT" || activity.type === "CHALLENGE" || activity.type === "LEARNING" ? <Link className="activity-shortcut-card" href={`/${locale}/admin/activities/${activity.id}/submissions`}><strong>{zh ? "成果提交" : "Submissions"}</strong><span>{zh ? "审核与归档" : "Review & archive"}</span></Link> : null}
        </div>
      </section>

      {activity.type === "EVENT" ? (
        <section className="activity-console-inline-grid">
          <article className="panel activity-console-panel">
            <div className="activity-console-panel-head">
              <div>
                <span className="label">{zh ? "议程" : "Agenda"}</span>
                <h3>{zh ? "同页议程编辑" : "Inline agenda"}</h3>
              </div>
              <Link href={`/${locale}/admin/activities/${activity.id}/agenda`}>{zh ? "全屏管理" : "Full page"}</Link>
            </div>
            <AdminActivityAgendaClient activityId={activity.id} initialAgendaItems={agendaItems ?? []} locale={locale} speakers={allSpeakers ?? []} />
          </article>

          <article className="panel activity-console-panel">
            <div className="activity-console-panel-head">
              <div>
                <span className="label">{zh ? "嘉宾" : "Speakers"}</span>
                <h3>{zh ? "同页嘉宾编排" : "Inline speaker roster"}</h3>
              </div>
              <Link href={`/${locale}/admin/activities/${activity.id}/speakers`}>{zh ? "全屏管理" : "Full page"}</Link>
            </div>
            <AdminActivitySpeakersClient activityId={activity.id} allSpeakers={allSpeakers ?? []} initialSpeakers={speakerLinks ?? []} locale={locale} />
          </article>

          <article className="panel activity-console-panel">
            <div className="activity-console-panel-head">
              <div>
                <span className="label">{zh ? "验证员" : "Verifiers"}</span>
                <h3>{zh ? "现场核验分配" : "Verifier assignment"}</h3>
              </div>
              <Link href={`/${locale}/admin/activities/${activity.id}/verifiers`}>{zh ? "全屏管理" : "Full page"}</Link>
            </div>
            <AdminActivityVerifiersClient activityId={activity.id} availableVerifiers={availableVerifiers ?? []} initialVerifiers={verifiers ?? []} locale={locale} />
          </article>

          <article className="panel activity-console-panel">
            <div className="activity-console-panel-head">
              <div>
                <span className="label">{zh ? "机构" : "Institutions"}</span>
                <h3>{zh ? "主办与联办关联" : "Host and partner links"}</h3>
              </div>
            </div>
            <AdminActivityInstitutionsClient activityId={activity.id} availableInstitutions={availableInstitutions ?? []} initialInstitutions={institutions ?? []} locale={locale} />
          </article>
        </section>
      ) : null}
    </div>
  );
}
