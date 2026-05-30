"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/site-content";

/* ── Types ── */
type ActivityType = "EVENT" | "LEARNING" | "CHALLENGE" | "PROJECT" | "TASK" | "COURSE";

/* ── Constants ── */
const ACTIVITY_TYPES: ActivityType[] = ["EVENT", "LEARNING", "CHALLENGE", "PROJECT", "TASK", "COURSE"];

const TYPE_META: Record<ActivityType, { zhName: string; enName: string; zhDesc: string; enDesc: string }> = {
  EVENT:     { zhName: "活动",     enName: "Event",     zhDesc: "会议、峰会、典礼",           enDesc: "Conference, summit, ceremony" },
  LEARNING:  { zhName: "学习",     enName: "Learning",  zhDesc: "项目、工作坊、交流",         enDesc: "Program, workshop, exchange" },
  CHALLENGE: { zhName: "挑战",     enName: "Challenge", zhDesc: "活动、竞赛",                 enDesc: "Campaign, competition" },
  PROJECT:   { zhName: "项目",     enName: "Project",   zhDesc: "团队项目、行动实验室",       enDesc: "Team project, action lab" },
  TASK:      { zhName: "任务",     enName: "Task",      zhDesc: "签到、提交、测验",           enDesc: "Check-in, submission, quiz" },
  COURSE:    { zhName: "课程",     enName: "Course",    zhDesc: "在线课程、LMS同步",          enDesc: "Online course, LMS sync" },
};

const LOCATION_TYPES = ["ONLINE", "OFFLINE", "HYBRID"] as const;
const VISIBILITY_OPTIONS = ["PUBLIC", "PRIVATE", "UNLISTED", "INVITE_ONLY"] as const;
const STATUS_OPTIONS = ["DRAFT", "PUBLISHED", "SCHEDULED"] as const;
const LANGUAGE_OPTIONS = ["zh", "en", "bilingual"] as const;

const TYPE_ICON_COLOR: Record<ActivityType, string> = {
  EVENT: "#1f5a4e", LEARNING: "#2563eb", CHALLENGE: "#c4893f",
  PROJECT: "#7c3aed", TASK: "#4a8a6a", COURSE: "#b8860b",
};

/* ── SVG Icons ── */
function IconEvent({ s = 20 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function IconBook({ s = 20 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
}
function IconZap({ s = 20 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}
function IconFolder({ s = 20 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function IconCheckSquare({ s = 20 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
}
function IconGraduation({ s = 20 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5"/></svg>;
}
function IconEdit({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconTrash({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
}
function IconPlus({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconEye({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function IconCheck({ s = 14 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function IconAlert({ s = 14 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function IconImage({ s = 28 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
function IconUser({ s = 24 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function IconList({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
function IconClock({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function IconStar({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function IconAward({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>;
}
function IconLogIn({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>;
}
function IconUsers({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>;
}
function IconChevronUp({ s = 14 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>;
}
function IconChevronDown({ s = 14 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
}
function IconX({ s = 14 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconSave({ s = 14 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
}
function IconCopy({ s = 14 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}

const TYPE_ICON: Record<ActivityType, React.FC<{ s?: number }>> = {
  EVENT: IconEvent, LEARNING: IconBook, CHALLENGE: IconZap,
  PROJECT: IconFolder, TASK: IconCheckSquare, COURSE: IconGraduation,
};

/* ── Section Title Icon Map ── */
const SECTION_ICONS: Record<string, React.FC<{ s?: number }>> = {
  basic: IconEdit, time: IconClock, agenda: IconList, speakers: IconUsers,
  highlights: IconStar, vip: IconAward, checkin: IconLogIn, registration: IconUsers,
  rewards: IconAward, learning: IconBook, challenge: IconZap, project: IconFolder,
  task: IconCheckSquare, course: IconGraduation,
};

/* ── Main Component ── */
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
  const zh = locale === "zh";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Form state ── */
  const [type, setType] = useState<ActivityType>(initial?.type ?? "EVENT");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [subtitleEn, setSubtitleEn] = useState(initial?.subtitleEn ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [summaryEn, setSummaryEn] = useState(initial?.summaryEn ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [descriptionEn, setDescriptionEn] = useState(initial?.descriptionEn ?? "");
  const [organizerName, setOrganizerName] = useState(initial?.organizerName ?? "");
  const [partnerNames, setPartnerNames] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  const [startTime, setStartTime] = useState(initial?.startTime ? initial.startTime.slice(0, 16) : "");
  const [endTime, setEndTime] = useState(initial?.endTime ? initial.endTime.slice(0, 16) : "");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Shanghai");
  const [locationType, setLocationType] = useState(initial?.locationType ?? "OFFLINE");
  const [onlineUrl, setOnlineUrl] = useState(initial?.onlineUrl ?? "");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [mapUrl, setMapUrl] = useState(initial?.mapUrl ?? "");

  const [capacity, setCapacity] = useState(initial?.capacity?.toString() ?? "");
  const [registrationOpenAt, setRegistrationOpenAt] = useState(initial?.registrationOpenAt ? initial.registrationOpenAt.slice(0, 16) : "");
  const [registrationCloseAt, setRegistrationCloseAt] = useState(initial?.registrationCloseAt ? initial.registrationCloseAt.slice(0, 16) : "");
  const [requiresApproval, setRequiresApproval] = useState(initial?.requiresApproval ?? false);
  const [applicationForm, setApplicationForm] = useState("default");

  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [visibility, setVisibility] = useState(initial?.visibility ?? "PUBLIC");
  const [language, setLanguage] = useState(initial?.language ?? "zh");
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false);
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [posterImage, setPosterImage] = useState(initial?.posterImage ?? "");

  /* ── Dynamic lists (placeholder data for prototype) ── */
  const [agendaItems, setAgendaItems] = useState([
    { id: "1", time: "09:00 – 09:30", title: zh ? "签到与欢迎咖啡" : "Registration & Welcome Coffee", location: zh ? "主大厅" : "Main Lobby", isBreak: false, speakers: [] },
    { id: "2", time: "09:30 – 10:15", title: zh ? "开幕主旨演讲：气候行动的未来" : "Opening Keynote: The Future of Climate Action", location: zh ? "A大厅" : "Grand Hall A", isBreak: false, speakers: ["Dr. Sarah Chen"] },
    { id: "3", time: "10:15 – 11:00", title: zh ? "圆桌讨论：绿色金融与全球气候治理" : "Panel Discussion: Green Finance & Global Climate Governance", location: zh ? "A大厅" : "Grand Hall A", isBreak: false, speakers: ["Prof. Wang Lei", "Michael Torres", "Dr. Aiko Tanaka"] },
    { id: "4", time: "11:00 – 11:15", title: zh ? "茶歇与交流" : "Tea Break & Networking", location: "", isBreak: true, speakers: [] },
  ]);

  const [speakers, setSpeakers] = useState([
    { id: "1", name: "Dr. Sarah Chen", title: "Director, UN Climate Change Division", bio: "Leading expert in international climate policy with 20+ years of experience.", roles: ["speaker"] },
    { id: "2", name: "Prof. Wang Lei", title: "Professor of Environmental Economics, Fudan University", bio: "Specializes in green finance mechanisms and carbon trading systems.", roles: ["panelist", "mentor"] },
    { id: "3", name: "Michael Torres", title: "CEO, GreenTech Ventures", bio: "Serial entrepreneur focused on climate-tech startups.", roles: ["panelist"] },
    { id: "4", name: "Dr. Aiko Tanaka", title: "Senior Researcher, IPCC Working Group II", bio: "Climate adaptation and resilience expert.", roles: ["moderator"] },
  ]);

  const [highlights, setHighlights] = useState([
    { id: "1", title: zh ? "开幕式与主旨演讲" : "Opening Ceremony & Keynote", desc: zh ? "联合国气候司司长发表全球气候行动路线图主旨演讲" : "UN Climate Division Director's keynote on global climate action roadmap.", featured: true, color: "linear-gradient(135deg, #c4dcc8, #8fb89a)" },
    { id: "2", title: zh ? "绿色金融圆桌" : "Green Finance Panel", desc: zh ? "行业领袖讨论可持续投资与碳交易机制" : "Industry leaders discuss sustainable investment and carbon trading.", featured: false, color: "linear-gradient(135deg, #e8c88a, #c4893f)" },
    { id: "3", title: zh ? "青年创新展示" : "Youth Innovation Showcase", desc: zh ? "学生团队展示气候解决方案与互动展览" : "Student teams present climate solutions with interactive exhibitions.", featured: false, color: "linear-gradient(135deg, #dbeafe, #93c5fd)" },
  ]);

  const [vips, setVips] = useState([
    { id: "1", name: "Dr. Sarah Chen", role: "Keynote Speaker · UN Climate Change", priority: 1, featured: true },
    { id: "2", name: "Prof. Wang Lei", role: "Panelist · Fudan University", priority: 2, featured: false },
    { id: "3", name: "Michael Torres", role: "Panelist · GreenTech Ventures", priority: 3, featured: false },
  ]);

  const [ticketTypes, setTicketTypes] = useState([
    { id: "1", name: "Standard", price: 0, capacity: 250 },
    { id: "2", name: "VIP", price: 500, capacity: 50 },
  ]);

  const [milestones, setMilestones] = useState([
    { id: "1", title: zh ? "研究与发现" : "Research & Discovery", dueDate: "2026-05-15" },
    { id: "2", title: zh ? "原型与测试" : "Prototype & Testing", dueDate: "2026-06-30" },
  ]);

  const [lessons, setLessons] = useState([
    { id: "1", title: zh ? "气候科学导论" : "Introduction to Climate Science", url: "", duration: 45 },
    { id: "2", title: zh ? "碳循环与温室气体" : "Carbon Cycles & Greenhouse Gases", url: "", duration: 60 },
  ]);

  const [rewardRules, setRewardRules] = useState([
    { id: "1", trigger: "Check-in Completed", type: "Points", value: "20 points" },
    { id: "2", trigger: "Participation Completed", type: "Certificate", value: "SHCW 2026 Certificate" },
  ]);

  /* ── Helpers ── */
  function autoSlug(t: string) {
    return t.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }

  function t(zhText: string, enText: string) {
    return zh ? zhText : enText;
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags((prev) => [...prev, tagInput.trim()]);
      }
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  /* ── Checklist progress ── */
  const checklist = useMemo(() => {
    const items = [
      { label: t("已选择活动类型", "Activity type selected"), done: true },
      { label: t("已填写标题", "Title provided"), done: !!title },
      { label: t("已设置日期时间", "Date & time set"), done: !!startTime && !!endTime },
      { label: t("已配置地点", "Location configured"), done: !!locationType },
      { label: t("需要描述", "Description needed"), done: !!description, warn: !description },
      { label: t("缺少封面图", "Cover image missing"), done: !!coverImage, warn: !coverImage },
      { label: t("议程有项目", "Agenda has items"), done: agendaItems.length > 0 },
      { label: t("已添加演讲者", "Speakers added"), done: speakers.length > 0 },
    ];
    const doneCount = items.filter((i) => i.done).length;
    const percent = Math.round((doneCount / items.length) * 100);
    return { items, doneCount, total: items.length, percent };
  }, [title, startTime, endTime, locationType, description, coverImage, agendaItems.length, speakers.length, zh]);

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent, publish = false) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        type,
        title,
        titleEn: titleEn || undefined,
        subtitle: subtitle || undefined,
        subtitleEn: subtitleEn || undefined,
        slug: slug || autoSlug(title),
        category: category || undefined,
        summary: summary || undefined,
        summaryEn: summaryEn || undefined,
        description: description || undefined,
        descriptionEn: descriptionEn || undefined,
        organizerName: organizerName || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        timezone,
        locationType,
        onlineUrl: onlineUrl || undefined,
        locationJson: (locationType === "OFFLINE" || locationType === "HYBRID")
          ? { ...(venueName && { venue: venueName }), ...(address && { address }), ...(mapUrl && { mapUrl }) }
          : undefined,
        status: publish ? "PUBLISHED" : status,
        visibility,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
        registrationOpenAt: registrationOpenAt || undefined,
        registrationCloseAt: registrationCloseAt || undefined,
        requiresApproval,
        isFeatured,
        isPinned,
        isPrivate,
        language,
        tags,
        coverImage: coverImage || undefined,
        posterImage: posterImage || undefined,
        mapUrl: mapUrl || undefined,
        highlights: highlights.length > 0 ? highlights.map((h, i) => ({ order: i + 1, title: h.title, description: h.desc, featured: h.featured })) : undefined,
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
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      router.push(`/${locale}/admin/activities/${data.activity.id}`);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  /* ── Section wrapper ── */
  function Section({ icon, title, badge, desc, children, right }: {
    icon: string; title: string; badge?: string; desc?: string;
    children: React.ReactNode; right?: React.ReactNode;
  }) {
    const Icon = SECTION_ICONS[icon] ?? IconEdit;
    return (
      <div className="create-form-section">
        <div className="create-section-header">
          <div className="create-section-title">
            <div className="create-section-title-icon"><Icon /></div>
            <h3>{title}</h3>
            {badge ? <span className="create-section-badge">{badge}</span> : null}
          </div>
          {right}
        </div>
        {desc ? <p className="create-section-desc">{desc}</p> : null}
        {children}
      </div>
    );
  }

  /* ── Form row helpers ── */
  function Row({ children, single = false, triple = false, style }: { children: React.ReactNode; single?: boolean; triple?: boolean; style?: React.CSSProperties }) {
    return <div className={`create-form-row ${single ? "single" : ""} ${triple ? "triple" : ""}`} style={style}>{children}</div>;
  }

  function Group({ label, children, required = false, optional = false, hint }: {
    label: string; children: React.ReactNode; required?: boolean; optional?: boolean; hint?: string;
  }) {
    return (
      <div className="create-form-group">
        <label className="create-form-label">
          {label}
          {required ? <span className="required">*</span> : null}
          {optional ? <span className="optional">{t("可选", "optional")}</span> : null}
        </label>
        {children}
        {hint ? <div className="create-form-hint">{hint}</div> : null}
      </div>
    );
  }

  /* ── Toggle helper ── */
  function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
      <label className="create-form-toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="create-toggle-switch" />
        <span className="create-form-toggle-text">{label}</span>
      </label>
    );
  }

  return (
    <form onSubmit={(e) => handleSubmit(e)}>
      {error ? <div className="form-error" style={{ margin: "0 36px 16px" }}>{error}</div> : null}
      <div className="create-activity-wrap">
        <div className="create-form-area">

          {/* ══════════ TYPE SELECTOR ══════════ */}
          <div className="type-selector">
            <div className="type-selector-label">{t("活动类型", "Activity Type")}</div>
            <div className="type-grid">
              {ACTIVITY_TYPES.map((tKey) => {
                const meta = TYPE_META[tKey];
                const Icon = TYPE_ICON[tKey];
                return (
                  <div
                    key={tKey}
                    className={`type-card ${type === tKey ? "selected" : ""}`}
                    data-type={tKey}
                    onClick={() => setType(tKey)}
                  >
                    <div className="type-card-icon"><Icon /></div>
                    <div className="type-card-name">{zh ? meta.zhName : meta.enName}</div>
                    <div className="type-card-desc">{zh ? meta.zhDesc : meta.enDesc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══════════ SECTION 1: Basic Information ══════════ */}
          <Section icon="basic" title={t("基本信息", "Basic Information")} badge={t("所有类型", "All Types")}>
            <Row>
              <Group label={t("标题（中文）", "Title (ZH)")} required>
                <input className="create-form-input" value={title} onChange={(e) => { setTitle(e.target.value); if (mode === "create" && !slug) setSlug(autoSlug(e.target.value)); }} placeholder={t("活动标题", "Activity title")} />
              </Group>
              <Group label={t("标题（英文）", "Title (EN)")} optional>
                <input className="create-form-input" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Activity title in English" />
              </Group>
            </Row>
            <Row>
              <Group label={t("副标题", "Subtitle")} optional>
                <input className="create-form-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={t("副标题", "Subtitle")} />
              </Group>
              <Group label={t("副标题（英文）", "Subtitle (EN)")} optional>
                <input className="create-form-input" value={subtitleEn} onChange={(e) => setSubtitleEn(e.target.value)} placeholder="Subtitle in English" />
              </Group>
            </Row>
            <Row>
              <Group label="Slug" required hint={t("自动从标题生成，可自定义URL路径", "Auto-generated from title. Edit to customize URL path.")}>
                <input className="create-form-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="url-friendly-slug" />
              </Group>
              <Group label={t("分类", "Category")}>
                <select className="create-form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">{t("选择分类…", "Select category…")}</option>
                  <option value="Climate Action">{t("气候行动", "Climate Action")}</option>
                  <option value="Green Finance">{t("绿色金融", "Green Finance")}</option>
                  <option value="Youth Leadership">{t("青年领导力", "Youth Leadership")}</option>
                  <option value="Education">{t("教育", "Education")}</option>
                  <option value="Technology">{t("科技", "Technology")}</option>
                  <option value="Biodiversity">{t("生物多样性", "Biodiversity")}</option>
                </select>
              </Group>
            </Row>
            <Row single>
              <Group label={t("摘要（中文）", "Summary (ZH)")} optional>
                <textarea className="create-form-input" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t("一句话描述…", "One-line summary…")} />
              </Group>
            </Row>
            <Row single>
              <Group label={t("摘要（英文）", "Summary (EN)")} optional>
                <textarea className="create-form-input" rows={2} value={summaryEn} onChange={(e) => setSummaryEn(e.target.value)} placeholder="One-line summary…" />
              </Group>
            </Row>
            <Row single>
              <Group label={t("描述（中文）", "Description (ZH)")}>
                <textarea className="create-form-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("详细描述…支持 Markdown", "Full description… Markdown supported")} />
              </Group>
            </Row>
            <Row single>
              <Group label={t("描述（英文）", "Description (EN)")}>
                <textarea className="create-form-input" rows={4} value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} placeholder="Full description… Markdown supported" />
              </Group>
            </Row>
            <Row single>
              <Group label={t("封面图", "Cover Image")}>
                <div className="create-cover-upload" onClick={() => alert(t("上传封面图", "Upload cover image"))}>
                  <IconImage />
                  <span>{t("点击上传封面图", "Click to upload cover image")}</span>
                  <span className="hint">{t("推荐：1200×630px，JPG或PNG，最大5MB", "Recommended: 1200×630px, JPG or PNG, max 5MB")}</span>
                </div>
              </Group>
            </Row>
            <Row>
              <Group label={t("组织方", "Organizer")}>
                <input className="create-form-input" value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} placeholder={t("组织方名称", "Organizer name")} />
              </Group>
              <Group label={t("合作伙伴", "Partners")}>
                <input className="create-form-input" value={partnerNames} onChange={(e) => setPartnerNames(e.target.value)} placeholder={t("合作伙伴（逗号分隔）", "Partner organizations (comma-separated)")} />
              </Group>
            </Row>
            <Row single>
              <Group label={t("标签", "Tags")}>
                <div className="create-tag-input-wrap">
                  {tags.map((tag) => (
                    <span key={tag} className="create-tag-pill">{tag} <button type="button" onClick={() => removeTag(tag)}>×</button></span>
                  ))}
                  <input type="text" placeholder={t("添加标签 + 回车", "Add tag + Enter")} value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} />
                </div>
              </Group>
            </Row>
          </Section>

          {/* ══════════ SECTION 2: Time & Location ══════════ */}
          <Section icon="time" title={t("时间与地点", "Time & Location")} badge={t("所有类型", "All Types")}>
            <Row triple>
              <Group label={t("开始时间", "Start Time")}>
                <input className="create-form-input" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </Group>
              <Group label={t("结束时间", "End Time")}>
                <input className="create-form-input" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Group>
              <Group label={t("时区", "Timezone")}>
                <select className="create-form-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                </select>
              </Group>
            </Row>
            <Row>
              <Group label={t("地点类型", "Location Type")}>
                <div className="create-loc-type-group">
                  {LOCATION_TYPES.map((lt) => (
                    <button key={lt} type="button" className={locationType === lt ? "active" : ""} onClick={() => setLocationType(lt)}>
                      {lt === "OFFLINE" ? t("线下", "Offline") : lt === "ONLINE" ? t("线上", "Online") : t("混合", "Hybrid")}
                    </button>
                  ))}
                </div>
              </Group>
              <Group label={t("在线链接", "Online URL")} optional={locationType !== "ONLINE"}>
                <input className="create-form-input" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://zoom.us/j/..." />
              </Group>
            </Row>
            {(locationType === "OFFLINE" || locationType === "HYBRID") && (
              <>
                <Row>
                  <Group label={t("场馆名称", "Venue Name")}>
                    <input className="create-form-input" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder={t("上海展览中心", "Shanghai Exhibition Center")} />
                  </Group>
                  <Group label={t("详细地址", "Address")}>
                    <input className="create-form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("上海市静安区南京西路1000号", "1000 Nanjing West Road, Jing'an, Shanghai")} />
                  </Group>
                </Row>
              </>
            )}
            <Row single>
              <Group label={t("地图链接", "Map URL")} optional>
                <input className="create-form-input" value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.google.com/..." />
              </Group>
            </Row>
          </Section>

          {/* ══════════ SECTION 3: EVENT — Agenda ══════════ */}
          {type === "EVENT" && (
            <Section
              icon="agenda"
              title={t("议程 / 日程", "Agenda / Schedule")}
              badge="EVENT"
              desc={t("按天构建活动日程。拖放重新排序，从嘉宾池中分配演讲者。", "Build the event schedule day by day. Drag to reorder, assign speakers from the guest pool.")}
              right={<button type="button" className="button button-ghost" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => alert(t("添加日期", "Add Day"))}>+ {t("添加日期", "Add Day")}</button>}
            >
              <div className="create-day-tabs">
                <button type="button" className="create-day-tab active">{t("第一天 · 6月15日", "Day 1 · Jun 15")}</button>
                <button type="button" className="create-day-tab">{t("第二天 · 6月16日", "Day 2 · Jun 16")}</button>
                <button type="button" className="create-day-tab">{t("第三天 · 6月17日", "Day 3 · Jun 17")}</button>
              </div>
              <div className="create-agenda-timeline">
                {agendaItems.map((item) => (
                  <div className={`create-agenda-item ${item.isBreak ? "break-item" : ""}`} key={item.id}>
                    <div className="create-agenda-item-time">
                      {item.time}
                      {item.isBreak ? <span className="break-badge">{t("休息", "Break")}</span> : null}
                    </div>
                    <div className="create-agenda-item-title">{item.title}</div>
                    <div className="create-agenda-item-meta">
                      {item.speakers.map((s) => <span key={s} className="speaker-chip">{s}</span>)}
                      {item.location ? <span className="location-chip">{item.location}</span> : null}
                    </div>
                    <div className="create-agenda-item-actions">
                      <button type="button" title={t("编辑", "Edit")} onClick={() => alert(t("编辑议程", "Edit agenda"))}><IconEdit s={13} /></button>
                      <button type="button" className="del" title={t("删除", "Remove")} onClick={() => setAgendaItems((prev) => prev.filter((i) => i.id !== item.id))}><IconTrash s={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                <button type="button" className="create-add-item-btn" style={{ flex: 1 }} onClick={() => alert(t("添加议程", "Add Session"))}><IconPlus />{t("添加议程", "Add Session")}</button>
                <button type="button" className="create-add-item-btn" style={{ flex: 1, borderColor: "rgba(196,137,63,0.2)", color: "var(--cp-accent-gold)" }} onClick={() => alert(t("添加休息", "Add Break"))}><IconPlus />{t("添加休息", "Add Break")}</button>
              </div>
            </Section>
          )}

          {/* ══════════ SECTION 4: Speakers & Guests ══════════ */}
          {(type === "EVENT" || type === "LEARNING") && (
            <Section
              icon="speakers"
              title={t("演讲者与嘉宾", "Speakers & Guests")}
              badge="EVENT · LEARNING"
              desc={t("管理此活动的演讲者/嘉宾池。分配角色并关联到议程环节。", "Manage the speaker/guest pool for this activity. Assign roles and link to agenda sessions.")}
              right={<button type="button" className="button button-ghost" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => alert(t("从人员模块导入", "Import from People"))}>{t("从人员导入", "Import from People")}</button>}
            >
              <div className="create-dynamic-list">
                {speakers.map((sp) => (
                  <div className="create-speaker-card" key={sp.id}>
                    <div className="create-speaker-avatar"><IconUser s={24} /></div>
                    <div className="create-speaker-info">
                      <h4>{sp.name}</h4>
                      <div className="create-speaker-title">{sp.title}</div>
                      <div className="create-speaker-bio">{sp.bio}</div>
                      <div>
                        {sp.roles.map((r) => (
                          <span key={r} className={`create-speaker-role-badge create-role-${r}`}>
                            {r === "speaker" ? t("主讲人", "Speaker") : r === "moderator" ? t("主持人", "Moderator") : r === "panelist" ? t("圆桌嘉宾", "Panelist") : r === "mentor" ? t("导师", "Mentor") : t("嘉宾", "Guest")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="create-speaker-actions">
                      <button type="button" title={t("编辑", "Edit")} onClick={() => alert(t("编辑演讲者", "Edit speaker"))}><IconEdit s={14} /></button>
                      <button type="button" className="del" title={t("删除", "Remove")} onClick={() => setSpeakers((prev) => prev.filter((s) => s.id !== sp.id))}><IconTrash s={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="create-add-item-btn" style={{ marginTop: "12px" }} onClick={() => alert(t("添加演讲者", "Add Speaker"))}><IconPlus />{t("添加演讲者 / 嘉宾", "Add Speaker / Guest")}</button>
            </Section>
          )}

          {/* ══════════ SECTION 5: Highlights ══════════ */}
          {(type === "EVENT" || type === "LEARNING" || type === "PROJECT") && (
            <Section
              icon="highlights"
              title={t("亮点", "Highlights")}
              badge="EVENT · LEARNING · PROJECT"
              desc={t("在活动详情页和社交分享卡片上 prominently 展示的关键时刻和精选内容。", "Key moments and featured content displayed prominently on the activity detail page and social sharing cards.")}
            >
              <div className="create-highlight-grid">
                {highlights.map((hl) => (
                  <div className="create-highlight-card" key={hl.id}>
                    <div className="create-highlight-thumb" style={{ background: hl.color }}>
                      <span className="highlight-order">{hl.id}</span>
                      <IconImage s={28} />
                    </div>
                    <div className="create-highlight-body">
                      <h4>{hl.title}</h4>
                      <p>{hl.desc}</p>
                    </div>
                    {hl.featured ? <span className="create-highlight-featured-badge">{t("精选", "Featured")}</span> : null}
                    <div className="highlight-actions">
                      <button type="button" title={t("编辑", "Edit")} onClick={() => alert(t("编辑亮点", "Edit highlight"))}><IconEdit s={13} /></button>
                      <button type="button" className="del" title={t("删除", "Remove")} onClick={() => setHighlights((prev) => prev.filter((h) => h.id !== hl.id))}><IconTrash s={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="create-add-item-btn" style={{ marginTop: "12px" }} onClick={() => alert(t("添加亮点", "Add Highlight"))}><IconPlus />{t("添加亮点", "Add Highlight")}</button>
            </Section>
          )}

          {/* ══════════ SECTION 6: VIP ══════════ */}
          {(type === "EVENT" || type === "LEARNING") && (
            <Section
              icon="vip"
              title={t("VIP 与重要嘉宾", "VIP & Important Guests")}
              badge="EVENT · LEARNING"
              desc={t("选择要在活动页面 prominently 展示的演讲者。拖动设置显示优先级（1 = 最高）。", "Select speakers to feature prominently on the activity page. Drag to set display priority (1 = highest).")}
            >
              <div className="create-vip-grid">
                {vips.map((vip) => (
                  <div className={`create-vip-card ${vip.featured ? "is-featured" : ""}`} key={vip.id}>
                    <span className="create-vip-priority">{vip.priority}</span>
                    <div className="create-vip-avatar"><IconUser s={22} /></div>
                    <h4>{vip.name}</h4>
                    <div className="create-vip-role">{vip.role}</div>
                    <div className="create-vip-card-actions">
                      <button type="button" title={t("上移", "Move up")}><IconChevronUp s={13} /></button>
                      <button type="button" title={t("下移", "Move down")}><IconChevronDown s={13} /></button>
                      <button type="button" className="del" title={t("从VIP移除", "Remove from VIP")} onClick={() => setVips((prev) => prev.filter((v) => v.id !== vip.id))}><IconX s={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="create-add-item-btn" style={{ marginTop: "12px" }} onClick={() => alert(t("从演讲者池选择VIP", "Select speaker to feature as VIP"))}><IconPlus />{t("从演讲者池添加VIP", "Add VIP from Speaker Pool")}</button>
            </Section>
          )}

          {/* ══════════ SECTION 7: Check-in & Tickets (EVENT) ══════════ */}
          {type === "EVENT" && (
            <Section icon="checkin" title={t("签到与票务", "Check-in & Tickets")} badge="EVENT">
              <Row triple>
                <Group label={t("签到方式", "Check-in Method")}>
                  <select className="create-form-select"><option>QR Code</option><option>{t("人工", "Manual")}</option><option>{t("地理位置", "Geo Location")}</option><option>NFC</option></select>
                </Group>
                <Group label={t("签到窗口", "Check-in Window")} hint={t("活动开始前/后的分钟数", "Minutes before/after session start")}>
                  <input className="create-form-input" type="number" defaultValue={30} />
                </Group>
                <Group label={t("场地容量", "Venue Capacity")}>
                  <input className="create-form-input" type="number" defaultValue={300} />
                </Group>
              </Row>
              <div style={{ marginTop: "14px" }}>
                <label className="create-form-label" style={{ marginBottom: "8px", display: "block" }}>{t("票种类型", "Ticket Types")}</label>
                <div className="create-dynamic-list">
                  {ticketTypes.map((tk, idx) => (
                    <div className="create-dynamic-item" key={tk.id}>
                      <div className="create-dynamic-item-header"><span className="create-dynamic-item-index">{idx + 1}</span><div className="create-dynamic-item-actions"><button type="button" className="del" onClick={() => setTicketTypes((prev) => prev.filter((t) => t.id !== tk.id))}><IconTrash s={14} /></button></div></div>
                      <div className="create-dynamic-item-body"><Row triple>
                        <Group label={t("名称", "Name")}><input className="create-form-input" value={tk.name} onChange={(e) => setTicketTypes((prev) => prev.map((t) => t.id === tk.id ? { ...t, name: e.target.value } : t))} /></Group>
                        <Group label={t("价格（人民币）", "Price (CNY)")}><input className="create-form-input" type="number" value={tk.price} onChange={(e) => setTicketTypes((prev) => prev.map((t) => t.id === tk.id ? { ...t, price: parseInt(e.target.value) || 0 } : t))} /></Group>
                        <Group label={t("容量", "Capacity")}><input className="create-form-input" type="number" value={tk.capacity} onChange={(e) => setTicketTypes((prev) => prev.map((t) => t.id === tk.id ? { ...t, capacity: parseInt(e.target.value) || 0 } : t))} /></Group>
                      </Row></div>
                    </div>
                  ))}
                </div>
                <button type="button" className="create-add-item-btn" style={{ marginTop: "10px" }} onClick={() => setTicketTypes((prev) => [...prev, { id: Date.now().toString(), name: "", price: 0, capacity: 0 }])}><IconPlus />{t("添加票种", "Add Ticket Type")}</button>
              </div>
            </Section>
          )}

          {/* ══════════ SECTION 8: LEARNING-specific ══════════ */}
          {type === "LEARNING" && (
            <Section icon="learning" title={t("课程与学习成果", "Curriculum & Learning Outcomes")} badge="LEARNING">
              <Row single><Group label={t("课程概览", "Curriculum Overview")}><textarea className="create-form-input" rows={3} placeholder={t("描述课程大纲…", "Describe the program curriculum…")} /></Group></Row>
              <Row single><Group label={t("学习成果", "Learning Outcomes")}><textarea className="create-form-input" rows={3} placeholder={t("列出预期学习成果…", "List expected learning outcomes…")} /></Group></Row>
              <Row>
                <Group label={t("最低出勤率（%）", "Min. Attendance (%)")}><input className="create-form-input" type="number" defaultValue={80} min={0} max={100} /></Group>
                <Group label={t("完成证书", "Certificate on Completion")}><Toggle checked={true} onChange={() => {}} label={t("自动发放证书", "Auto-issue certificate")} /></Group>
              </Row>
              <Row single><Group label={t("申请要求", "Application Requirements")}><textarea className="create-form-input" rows={2} placeholder={t("描述任何先决条件或申请要求…", "Describe any prerequisites or application requirements…")} /></Group></Row>
            </Section>
          )}

          {/* ══════════ SECTION 9: CHALLENGE-specific ══════════ */}
          {type === "CHALLENGE" && (
            <Section icon="challenge" title={t("挑战配置", "Challenge Configuration")} badge="CHALLENGE">
              <Row single><Group label={t("挑战规则", "Challenge Rules")}><textarea className="create-form-input" rows={3} placeholder={t("描述挑战规则、评分和里程碑…", "Describe challenge rules, scoring, and milestones…")} /></Group></Row>
              <Row triple>
                <Group label={t("排行榜", "Leaderboard")}><Toggle checked={true} onChange={() => {}} label={t("启用排行榜", "Enable leaderboard")} /></Group>
                <Group label={t("团队模式", "Team Mode")}><Toggle checked={false} onChange={() => {}} label={t("允许团队", "Allow teams")} /></Group>
                <Group label={t("最大团队规模", "Max Team Size")}><input className="create-form-input" type="number" defaultValue={5} min={2} /></Group>
              </Row>
              <Row>
                <Group label={t("基础积分", "Base Points")}><input className="create-form-input" type="number" defaultValue={10} /></Group>
                <Group label={t("奖励条件", "Bonus Conditions")}><input className="create-form-input" placeholder="streak:3, perfect_week, team_complete" /></Group>
              </Row>
            </Section>
          )}

          {/* ══════════ SECTION 10: PROJECT-specific ══════════ */}
          {type === "PROJECT" && (
            <Section icon="project" title={t("项目配置", "Project Configuration")} badge="PROJECT">
              <Row single><Group label={t("项目背景", "Project Background")}><textarea className="create-form-input" rows={3} placeholder={t("描述项目背景、目标和范围…", "Describe the project context, goals, and scope…")} /></Group></Row>
              <div style={{ marginTop: "8px" }}>
                <label className="create-form-label" style={{ marginBottom: "8px", display: "block" }}>{t("里程碑", "Milestones")}</label>
                <div className="create-dynamic-list">
                  {milestones.map((ms, idx) => (
                    <div className="create-dynamic-item" key={ms.id}>
                      <div className="create-dynamic-item-header"><span className="create-dynamic-item-index">{idx + 1}</span><div className="create-dynamic-item-actions"><button type="button" className="del" onClick={() => setMilestones((prev) => prev.filter((m) => m.id !== ms.id))}><IconTrash s={14} /></button></div></div>
                      <div className="create-dynamic-item-body"><Row>
                        <Group label={t("标题", "Title")}><input className="create-form-input" value={ms.title} onChange={(e) => setMilestones((prev) => prev.map((m) => m.id === ms.id ? { ...m, title: e.target.value } : m))} /></Group>
                        <Group label={t("截止日期", "Due Date")}><input className="create-form-input" type="date" value={ms.dueDate} onChange={(e) => setMilestones((prev) => prev.map((m) => m.id === ms.id ? { ...m, dueDate: e.target.value } : m))} /></Group>
                      </Row></div>
                    </div>
                  ))}
                </div>
                <button type="button" className="create-add-item-btn" style={{ marginTop: "10px" }} onClick={() => setMilestones((prev) => [...prev, { id: Date.now().toString(), title: "", dueDate: "" }])}><IconPlus />{t("添加里程碑", "Add Milestone")}</button>
              </div>
            </Section>
          )}

          {/* ══════════ SECTION 11: TASK-specific ══════════ */}
          {type === "TASK" && (
            <Section icon="task" title={t("任务配置", "Task Configuration")} badge="TASK">
              <Row single><Group label={t("任务说明", "Task Instructions")}><textarea className="create-form-input" rows={3} placeholder={t("描述参与者需要做什么…", "Describe what participants need to do…")} /></Group></Row>
              <Row triple>
                <Group label={t("验证方式", "Verification Method")}>
                  <select className="create-form-select"><option>{t("照片上传", "Photo Upload")}</option><option>{t("管理员审核", "Admin Review")}</option><option>{t("自动（地理/二维码）", "Auto (Geo/QR)")}</option><option>{t("同伴审核", "Peer Review")}</option></select>
                </Group>
                <Group label={t("奖励积分", "Points Awarded")}><input className="create-form-input" type="number" defaultValue={10} /></Group>
                <Group label={t("需要凭证", "Proof Required")}>
                  <select className="create-form-select"><option>{t("照片", "Photo")}</option><option>{t("文字", "Text")}</option><option>{t("链接", "Link")}</option><option>{t("无", "None")}</option></select>
                </Group>
              </Row>
              <Row single>
                <Group label={t("允许重复签到", "Allow Repeated Check-in")}>
                  <Toggle checked={false} onChange={() => {}} label={t("参与者可以多次签到", "Participants can check in multiple times")} />
                </Group>
              </Row>
            </Section>
          )}

          {/* ══════════ SECTION 12: COURSE-specific ══════════ */}
          {type === "COURSE" && (
            <Section icon="course" title={t("课程配置", "Course Configuration")} badge="COURSE">
              <Row single><Group label={t("课程大纲", "Course Outline")}><textarea className="create-form-input" rows={3} placeholder={t("描述课程结构和学习路径…", "Describe the course structure and learning path…")} /></Group></Row>
              <div style={{ marginTop: "8px" }}>
                <label className="create-form-label" style={{ marginBottom: "8px", display: "block" }}>{t("课时", "Lessons")}</label>
                <div className="create-dynamic-list">
                  {lessons.map((ls, idx) => (
                    <div className="create-dynamic-item" key={ls.id}>
                      <div className="create-dynamic-item-header"><span className="create-dynamic-item-index">{idx + 1}</span><div className="create-dynamic-item-actions"><button type="button" className="del" onClick={() => setLessons((prev) => prev.filter((l) => l.id !== ls.id))}><IconTrash s={14} /></button></div></div>
                      <div className="create-dynamic-item-body"><Row triple>
                        <Group label={t("标题", "Title")}><input className="create-form-input" value={ls.title} onChange={(e) => setLessons((prev) => prev.map((l) => l.id === ls.id ? { ...l, title: e.target.value } : l))} /></Group>
                        <Group label={t("内容链接", "Content URL")}><input className="create-form-input" placeholder="https://…" value={ls.url} onChange={(e) => setLessons((prev) => prev.map((l) => l.id === ls.id ? { ...l, url: e.target.value } : l))} /></Group>
                        <Group label={t("时长（分钟）", "Duration (min)")}><input className="create-form-input" type="number" value={ls.duration} onChange={(e) => setLessons((prev) => prev.map((l) => l.id === ls.id ? { ...l, duration: parseInt(e.target.value) || 0 } : l))} /></Group>
                      </Row></div>
                    </div>
                  ))}
                </div>
                <button type="button" className="create-add-item-btn" style={{ marginTop: "10px" }} onClick={() => setLessons((prev) => [...prev, { id: Date.now().toString(), title: "", url: "", duration: 0 }])}><IconPlus />{t("添加课时", "Add Lesson")}</button>
              </div>
              <Row triple style={{ marginTop: "16px" }}>
                <Group label={t("测验及格分（%）", "Quiz Passing Score (%)")}><input className="create-form-input" type="number" defaultValue={70} /></Group>
                <Group label={t("最大测验次数", "Max Quiz Attempts")}><input className="create-form-input" type="number" defaultValue={3} /></Group>
                <Group label={t("最低课时完成率（%）", "Min. Lesson Completion (%)")}><input className="create-form-input" type="number" defaultValue={80} /></Group>
              </Row>
              <Row>
                <Group label={t("LMS 提供商", "LMS Provider")}>
                  <select className="create-form-select"><option>{t("内部", "Internal")}</option><option>Canvas</option><option>Moodle</option><option>{t("自定义", "Custom")}</option></select>
                </Group>
                <Group label={t("外部课程链接", "External Course URL")} optional>
                  <input className="create-form-input" placeholder="https://lms.example.com/course/…" />
                </Group>
              </Row>
            </Section>
          )}

          {/* ══════════ SECTION 13: Registration Settings ══════════ */}
          <Section icon="registration" title={t("报名设置", "Registration Settings")} badge={t("所有类型", "All Types")}>
            <Row triple>
              <Group label={t("容量", "Capacity")}>
                <input className="create-form-input" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t("最大参与者数", "Max participants")} />
              </Group>
              <Group label={t("报名开放时间", "Registration Opens")}>
                <input className="create-form-input" type="datetime-local" value={registrationOpenAt} onChange={(e) => setRegistrationOpenAt(e.target.value)} />
              </Group>
              <Group label={t("报名截止时间", "Registration Closes")}>
                <input className="create-form-input" type="datetime-local" value={registrationCloseAt} onChange={(e) => setRegistrationCloseAt(e.target.value)} />
              </Group>
            </Row>
            <Row>
              <Group label={t("需要审核", "Requires Approval")}>
                <Toggle checked={requiresApproval} onChange={setRequiresApproval} label={t("申请者需要管理员审核", "Applicants need admin approval")} />
              </Group>
              <Group label={t("报名表单", "Application Form")}>
                <select className="create-form-select" value={applicationForm} onChange={(e) => setApplicationForm(e.target.value)}>
                  <option value="default">{t("默认表单", "Default Form")}</option>
                  <option value="summer_school">{t("夏校申请", "Summer School Application")}</option>
                  <option value="custom">{t("自定义模板…", "Custom Template…")}</option>
                </select>
              </Group>
            </Row>
          </Section>

          {/* ══════════ SECTION 14: Rewards ══════════ */}
          <Section icon="rewards" title={t("奖励与证书", "Rewards & Certificates")} badge={t("所有类型", "All Types")}>
            <div className="create-dynamic-list">
              {rewardRules.map((rr, idx) => (
                <div className="create-dynamic-item" key={rr.id}>
                  <div className="create-dynamic-item-header"><span className="create-dynamic-item-index">{idx + 1}</span><div className="create-dynamic-item-actions"><button type="button" className="del" onClick={() => setRewardRules((prev) => prev.filter((r) => r.id !== rr.id))}><IconTrash s={14} /></button></div></div>
                  <div className="create-dynamic-item-body"><Row triple>
                    <Group label={t("触发条件", "Trigger")}>
                      <select className="create-form-select" value={rr.trigger} onChange={(e) => setRewardRules((prev) => prev.map((r) => r.id === rr.id ? { ...r, trigger: e.target.value } : r))}>
                        <option>{t("签到完成", "Check-in Completed")}</option>
                        <option>{t("报名通过", "Registration Approved")}</option>
                        <option>{t("任务完成", "Task Completed")}</option>
                        <option>{t("课程完成", "Course Completed")}</option>
                        <option>{t("作品通过", "Submission Approved")}</option>
                      </select>
                    </Group>
                    <Group label={t("奖励类型", "Reward Type")}>
                      <select className="create-form-select" value={rr.type} onChange={(e) => setRewardRules((prev) => prev.map((r) => r.id === rr.id ? { ...r, type: e.target.value } : r))}>
                        <option>{t("积分", "Points")}</option>
                        <option>{t("徽章", "Badge")}</option>
                        <option>{t("证书", "Certificate")}</option>
                        <option>{t("护照记录", "Passport Entry")}</option>
                      </select>
                    </Group>
                    <Group label={t("值", "Value")}>
                      <input className="create-form-input" value={rr.value} onChange={(e) => setRewardRules((prev) => prev.map((r) => r.id === rr.id ? { ...r, value: e.target.value } : r))} />
                    </Group>
                  </Row></div>
                </div>
              ))}
            </div>
            <button type="button" className="create-add-item-btn" style={{ marginTop: "10px" }} onClick={() => setRewardRules((prev) => [...prev, { id: Date.now().toString(), trigger: "Check-in Completed", type: "Points", value: "" }])}><IconPlus />{t("添加奖励规则", "Add Reward Rule")}</button>
          </Section>

        </div>{/* /form-area */}

        {/* ══════════ RIGHT PANEL ══════════ */}
        <div className="create-right-panel">
          {/* Progress */}
          <div className="create-panel-section">
            <div className="create-panel-section-title">{t("完成度", "Completion")}</div>
            <div className="create-panel-progress">
              <div className="create-panel-progress-label"><span>{t("必填字段", "Required fields")}</span><span>{checklist.doneCount} / {checklist.total}</span></div>
              <div className="create-panel-progress-bar"><div className={`create-panel-progress-fill ${checklist.percent >= 80 ? "create-fill-green" : checklist.percent >= 50 ? "create-fill-amber" : "create-fill-red"}`} style={{ width: `${checklist.percent}%` }} /></div>
            </div>
            <ul className="create-panel-checklist">
              {checklist.items.map((item, i) => (
                <li key={i}>
                  <span className={`check-icon ${item.done ? "create-check-done" : item.warn ? "create-check-warn" : "create-check-pending"}`}>
                    {item.done ? <IconCheck /> : item.warn ? <IconAlert /> : <IconPlus s={12} />}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="create-panel-divider" />

          {/* Publishing */}
          <div className="create-panel-section">
            <div className="create-panel-section-title">{t("发布", "Publishing")}</div>
            <div className="create-panel-field">
              <label>{t("状态", "Status")}</label>
              <select className="create-form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="create-panel-field">
              <label>{t("可见性", "Visibility")}</label>
              <select className="create-form-select" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="create-panel-field">
              <label>{t("语言", "Language")}</label>
              <select className="create-form-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="zh">中文 (ZH)</option>
                <option value="en">English (EN)</option>
                <option value="bilingual">{t("双语", "Bilingual")}</option>
              </select>
            </div>
            <div className="create-panel-field">
              <label>{t("精选", "Featured")}</label>
              <Toggle checked={isFeatured} onChange={setIsFeatured} label={t("在精选区域展示", "Show in featured section")} />
            </div>
          </div>

          <div className="create-panel-divider" />

          {/* Actions */}
          <div className="create-panel-section">
            <div className="create-panel-section-title">{t("操作", "Actions")}</div>
            <div className="create-panel-actions">
              <button type="submit" className="button" disabled={saving} onClick={(e) => handleSubmit(e, true)}>
                {saving ? t("保存中…", "Saving…") : <><IconCheck s={14} /> {t("立即发布", "Publish Now")}</>}
              </button>
              <button type="button" className="button button-secondary" disabled={saving} onClick={(e) => handleSubmit(e as any, false)}>
                <IconSave /> {t("保存草稿", "Save as Draft")}
              </button>
              <button type="button" className="button button-outline" onClick={() => alert(t("预览", "Preview"))}>
                <IconEye /> {t("预览", "Preview")}
              </button>
              {mode === "create" && (
                <button type="button" className="button button-ghost" onClick={() => alert(t("复制活动", "Duplicate activity"))}>
                  <IconCopy /> {t("复制", "Duplicate")}
                </button>
              )}
            </div>
          </div>

          <div className="create-panel-divider" />

          {/* Info */}
          <div className="create-panel-section">
            <div className="create-panel-section-title">{t("信息", "Info")}</div>
            <div style={{ fontSize: "11px", color: "var(--cp-ink)", lineHeight: 1.8, opacity: 0.7 }}>
              <div><strong>Slug:</strong> {slug || autoSlug(title) || "—"}</div>
              <div><strong>{t("创建时间", "Created")}:</strong> —</div>
              <div><strong>{t("最后保存", "Last saved")}:</strong> —</div>
              <div><strong>{t("活动ID", "Activity ID")}:</strong> <span style={{ opacity: 0.5 }}>{t("自动分配", "auto-assigned")}</span></div>
            </div>
          </div>
        </div>{/* /right-panel */}
      </div>{/* /wrap */}
    </form>
  );
}
