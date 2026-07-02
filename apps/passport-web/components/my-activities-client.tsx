"use client";

import { useState } from "react";
import Link from "next/link";

interface ActivityCard {
  id: string;
  activityId: string;
  slug: string;
  title: string;
  titleEn: string | null;
  type: string;
  activityStatus: string;
  participationStatus: string | null;
  pointsEarned: number;
  badgeCount: number;
  hasCertificate: boolean;
  passportSynced: boolean;
  startTime: string | null;
  completedAt: string | null;
  hasPendingCheckin: boolean;
  hasPendingSubmission: boolean;
  isApplication: boolean;
  appStatus: string | null;
}

interface Props {
  locale: string;
  cards: ActivityCard[];
}

// 10 tabs matching the plan
const TAB_DEFS = [
  { key: "submitted",   zh: "已报名",     en: "Applied" },
  { key: "pending",     zh: "待审核",     en: "Pending Review" },
  { key: "approved",    zh: "已录取",     en: "Accepted" },
  { key: "active",      zh: "进行中",     en: "In Progress" },
  { key: "checkin",     zh: "待打卡",     en: "Check-in Due" },
  { key: "submit",      zh: "待提交",     en: "Submit Due" },
  { key: "completed",   zh: "已完成",     en: "Completed" },
  { key: "certified",   zh: "已获证书",   en: "Certified" },
  { key: "badges",      zh: "已获徽章",   en: "With Badges" },
  { key: "history",     zh: "历史记录",   en: "History" },
] as const;

type TabKey = typeof TAB_DEFS[number]["key"];

function filterCards(cards: ActivityCard[], tab: TabKey): ActivityCard[] {
  switch (tab) {
    case "submitted":
      // Pending applications that haven't been reviewed yet
      return cards.filter(
        (c) => c.isApplication && c.appStatus === "SUBMITTED"
      );
    case "pending":
      return cards.filter(
        (c) => c.isApplication && ["PENDING_REVIEW", "WAITLISTED", "INTERVIEW"].includes(c.appStatus ?? "")
      );
    case "approved":
      return cards.filter(
        (c) =>
          (c.isApplication && ["APPROVED", "OFFERED"].includes(c.appStatus ?? "")) ||
          (!c.isApplication && ["REGISTERED", "ACCEPTED"].includes(c.participationStatus ?? ""))
      );
    case "active":
      return cards.filter(
        (c) =>
          !c.isApplication &&
          ["CHECKED_IN", "IN_PROGRESS"].includes(c.participationStatus ?? "")
      );
    case "checkin":
      return cards.filter(
        (c) =>
          !c.isApplication &&
          ["CHECKED_IN", "IN_PROGRESS"].includes(c.participationStatus ?? "") &&
          c.hasPendingCheckin
      );
    case "submit":
      return cards.filter(
        (c) =>
          !c.isApplication &&
          ["CHECKED_IN", "IN_PROGRESS"].includes(c.participationStatus ?? "") &&
          c.hasPendingSubmission
      );
    case "completed":
      return cards.filter((c) => !c.isApplication && c.participationStatus === "COMPLETED");
    case "certified":
      return cards.filter(
        (c) => !c.isApplication && (c.participationStatus === "CERTIFIED" || c.hasCertificate)
      );
    case "badges":
      return cards.filter((c) => !c.isApplication && c.badgeCount > 0);
    case "history":
      return cards.filter(
        (c) =>
          (!c.isApplication && ["ABSENT", "FAILED", "ARCHIVED"].includes(c.participationStatus ?? "")) ||
          (c.isApplication && ["REJECTED", "WITHDRAWN", "CANCELLED"].includes(c.appStatus ?? ""))
      );
  }
}

const STATUS_LABEL: Record<string, { zh: string; en: string; cls: string }> = {
  REGISTERED:  { zh: "已注册",  en: "Registered",  cls: "cpca-badge cpca-badge-blue" },
  ACCEPTED:    { zh: "已录取",  en: "Accepted",    cls: "cpca-badge cpca-badge-blue" },
  CHECKED_IN:  { zh: "已签到",  en: "Checked In",  cls: "cpca-badge cpca-badge-blue" },
  IN_PROGRESS: { zh: "进行中",  en: "In Progress", cls: "cpca-badge cpca-badge-blue" },
  COMPLETED:   { zh: "已完成",  en: "Completed",   cls: "cpca-badge cpca-badge-green" },
  CERTIFIED:   { zh: "已认证",  en: "Certified",   cls: "cpca-badge cpca-badge-blue" },
  FAILED:      { zh: "未完成",  en: "Failed",      cls: "cpca-badge cpca-badge-red" },
  ABSENT:      { zh: "缺席",    en: "Absent",      cls: "cpca-badge cpca-badge-red" },
  ARCHIVED:    { zh: "已归档",  en: "Archived",    cls: "" },
};

const APP_STATUS_LABEL: Record<string, { zh: string; en: string; cls: string }> = {
  SUBMITTED:      { zh: "审核中",   en: "Under Review",   cls: "cpca-badge cpca-badge-amber" },
  PENDING_REVIEW: { zh: "待审核",   en: "Pending",        cls: "cpca-badge cpca-badge-amber" },
  INTERVIEW:      { zh: "待面试",   en: "Interview",      cls: "cpca-badge cpca-badge-amber" },
  OFFERED:        { zh: "已录用",   en: "Offered",        cls: "cpca-badge cpca-badge-blue" },
  WAITLISTED:     { zh: "候补",     en: "Waitlisted",     cls: "cpca-badge cpca-badge-amber" },
  APPROVED:       { zh: "已录取",   en: "Approved",       cls: "cpca-badge cpca-badge-green" },
  REJECTED:       { zh: "未录取",   en: "Rejected",       cls: "cpca-badge cpca-badge-red" },
  WITHDRAWN:      { zh: "已撤回",   en: "Withdrawn",      cls: "" },
  CANCELLED:      { zh: "已取消",   en: "Cancelled",      cls: "" },
};

function getNextAction(
  c: ActivityCard,
  locale: string,
  zh: boolean
): { href: string; label: string; primary?: boolean } | null {
  if (c.isApplication) {
    if (c.appStatus === "APPROVED") {
      return { href: `/${locale}/activities/${c.slug}`, label: zh ? "查看活动详情" : "View activity", primary: true };
    }
    return null;
  }
  const ps = c.participationStatus;
  if (ps === "IN_PROGRESS" || ps === "CHECKED_IN") {
    if (c.hasPendingCheckin) return { href: `/${locale}/activities/${c.slug}/workspace`, label: zh ? "立即打卡" : "Check in now", primary: true };
    if (c.hasPendingSubmission) return { href: `/${locale}/activities/${c.slug}/workspace`, label: zh ? "提交成果" : "Submit work", primary: true };
    return { href: `/${locale}/activities/${c.slug}/workspace`, label: zh ? "查看任务进度" : "View progress" };
  }
  if (ps === "CERTIFIED") return { href: `/${locale}/activities/${c.slug}/workspace`, label: zh ? "下载证书" : "Download cert", primary: true };
  if (ps === "COMPLETED") {
    if (c.hasCertificate) return { href: `/${locale}/activities/${c.slug}/workspace`, label: zh ? "查看证书" : "View certificate" };
    return { href: `/${locale}/activities/${c.slug}/workspace`, label: zh ? "查看参与记录" : "View record" };
  }
  if (ps === "ACCEPTED") return { href: `/${locale}/activities/${c.slug}`, label: zh ? "查看活动" : "View activity" };
  if (ps === "REGISTERED") return { href: `/${locale}/activities/${c.slug}`, label: zh ? "查看活动" : "View activity" };
  return { href: `/${locale}/activities/${c.slug}`, label: zh ? "查看详情" : "View details" };
}

export default function MyActivitiesClient({ locale, cards }: Props) {
  const zh = locale === "zh";
  const [tab, setTab] = useState<TabKey>("active");

  const filtered = filterCards(cards, tab);

  return (
    <div >
      {/* 10-tab nav */}
      <div
        className="cert-admin-tabs"
        role="tablist"
        style={{ overflowX: "auto", whiteSpace: "nowrap", marginBottom: "1.25rem", display: "flex", gap: "0.35rem" }}
      >
        {TAB_DEFS.map((t) => {
          const count = filterCards(cards, t.key).length;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              className={`cert-admin-tab ${tab === t.key ? "cert-admin-tab active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {zh ? t.zh : t.en}
              {count > 0 && (
                <span style={{ marginLeft: "0.3rem", fontSize: "var(--cp-text-caption)", opacity: 0.7 }}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Card list */}
      {filtered.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", padding: "1rem 0" }}>
          {zh ? "此标签下暂无记录" : "No items in this tab"}
        </p>
      ) : (
        <div className="list">
          {filtered.map((c) => {
            const statusInfo = c.isApplication
              ? APP_STATUS_LABEL[c.appStatus ?? "SUBMITTED"]
              : STATUS_LABEL[c.participationStatus ?? ""];
            const nextAction = getNextAction(c, locale, zh);
            const displayTitle = zh ? c.title : (c.titleEn ?? c.title);

            return (
              <div className="list-item" key={c.id}>
                <div >
                  <Link href={`/${locale}/activities/${c.slug}`}>
                    <strong>{displayTitle}</strong>
                  </Link>
                  <div
                    style={{
                      marginTop: "0.35rem",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.35rem",
                      alignItems: "center",
                    }}
                  >
                    <span className="chip chip" style={{ fontSize: "var(--cp-text-caption)" }}>
                      {c.type}
                    </span>
                    {statusInfo && (
                      <span className={`chip ${statusInfo.cls}`}>
                        {statusInfo[zh ? "zh" : "en"]}
                      </span>
                    )}
                    {c.hasPendingCheckin && (
                      <span className="chip cpca-badge cpca-badge-amber">
                        {zh ? "待打卡" : "Check-in due"}
                      </span>
                    )}
                    {c.hasPendingSubmission && (
                      <span className="chip cpca-badge cpca-badge-amber">
                        {zh ? "待提交" : "Submit due"}
                      </span>
                    )}
                    {c.pointsEarned > 0 && (
                      <span style={{ fontSize: "var(--cp-text-small)", color: "var(--color-accent)" }}>
                        +{c.pointsEarned} pts
                      </span>
                    )}
                    {c.badgeCount > 0 && (
                      <span style={{ fontSize: "var(--cp-text-small)" }}>🏅 {c.badgeCount}</span>
                    )}
                    {c.hasCertificate && (
                      <span className="chip cpca-badge cpca-badge-blue">{zh ? "证书" : "Cert"}</span>
                    )}
                    {c.passportSynced && (
                      <span className="chip chip" style={{ color: "var(--color-teal, #0d9488)" }}>
                        {zh ? "护照✓" : "Passport✓"}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "0.4rem",
                    flexShrink: 0,
                    marginLeft: "0.75rem",
                  }}
                >
                  {c.startTime && (
                    <span style={{ fontSize: "var(--cp-text-caption)", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(c.startTime).toLocaleDateString(zh ? "zh-CN" : "en-US")}
                    </span>
                  )}
                  {nextAction && (
                    <Link
                      href={nextAction.href}
                      className={`button button${nextAction.primary ? " button" : ""}`}
                    >
                      {nextAction.label}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
