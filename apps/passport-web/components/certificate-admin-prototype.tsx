"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FormErrorText, FormHelpText, FormMessageText, FormSuccessText } from "@/components/form-feedback";
import { FieldLabelWithInfo } from "@/components/info-tooltip";
import type { Locale } from "@/lib/site-content";

export type CertificateAdminCategory = {
  id: string;
  key: string;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  order?: number;
  autoIssueEnabled?: boolean;
  userRequestEnabled?: boolean;
  pdfEnabled?: boolean;
  publicVerifyEnabled?: boolean;
  createdAt?: string;
  isActive: boolean;
  templateCount?: number;
  definitionCount?: number;
  issuedCount?: number;
};

export type CertificateAdminTemplate = {
  id: string;
  categoryId?: string;
  name: string;
  nameEn?: string | null;
  templateType: string;
  isActive: boolean;
  version: number;
  updatedAt?: string;
  categoryName?: string | null;
  categoryNameEn?: string | null;
  issuedCount?: number;
  renderConfig?: {
    issuerName?: string;
    signerName?: string;
    pageSize?: string;
    pageWidthMm?: number;
    pageHeightMm?: number;
    accentColor?: string;
    backgroundColor?: string;
    backgroundImageUrl?: string;
    logoImageUrl?: string;
    signatureImageUrl?: string;
    sealImageUrl?: string;
    elements?: unknown;
  };
  definition?: {
    name: string;
    nameEn?: string | null;
    approvalMode?: string | null;
  } | null;
};

export type CertificateAdminIssue = {
  id: string;
  certificateNumber: string;
  certificateName: string;
  categoryName: string;
  holderName: string;
  holderEmail?: string | null;
  issueDate: string;
  status: string;
  source?: string | null;
  verificationCount?: number;
  generatedFileUrl?: string | null;
  generatedFileName?: string | null;
  templateId?: string;
  issueVariableValues?: Record<string, unknown> | null;
};

export type CertificateAdminAuditLog = {
  id: string;
  time: string;
  primary: string;
  secondary: string;
  result: string;
  channel?: string;
  region?: string;
};

export type CertificateAdminBatchItem = {
  id: string;
  rowIndex: number;
  email: string;
  status: string;
  attempts: number;
  error?: string | null;
  certificateIssue?: {
    id: string;
    verificationCode?: string | null;
    status?: string;
    generatedFileName?: string | null;
  } | null;
};

export type CertificateAdminBatch = {
  id: string;
  idempotencyKey: string;
  source: string;
  status: string;
  templateId: string;
  definitionId?: string;
  activityId?: string | null;
  issueDate?: string | null;
  notifyRecipients?: boolean;
  totalCount: number;
  succeededCount: number;
  failedCount: number;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
  definition?: { name: string; nameEn?: string | null } | null;
  activity?: { id: string; title: string; titleEn?: string | null } | null;
  createdBy?: { name: string } | null;
  items?: CertificateAdminBatchItem[];
};

type CertificateBatchActivityOption = {
  id: string;
  title: string;
  titleEn?: string | null;
  status: string;
  participations: number;
};

type CertificateBatchPreflightRow = {
  row: number;
  raw: string;
  state: "ok" | "malformed" | "duplicate" | "existing_issue";
  email?: string;
  userName?: string;
  issueId?: string;
  verificationCode?: string;
};

type CertificateBatchPreflightReport = {
  definitionName?: string;
  rows?: CertificateBatchPreflightRow[];
  recipients?: Array<{ email: string; userName: string }>;
  activity?: {
    id: string;
    title: string;
    titleEn?: string | null;
    eligibleCount: number;
    alreadyIssuedCount: number;
  };
  summary?: { total: number; valid: number; malformed: number; duplicates: number; existingIssues: number };
};

type CertificateIssuingRuleRow = {
  id: string;
  name: string;
  activityId: string;
  certificateDefinitionId: string;
  trigger: "ACTIVITY_CHECKIN";
  isActive: boolean;
  notifyUser: boolean;
  effective: boolean;
  eligible: boolean;
  activity: { id: string; title: string; titleEn?: string | null };
  certificateDefinition: { id: string; name: string; nameEn?: string | null };
  _count?: { issuances: number };
};

type CertificateTemplateRenderElementInput = {
  kind?: string;
  variable?: string;
  label?: string;
  visible?: boolean;
};

type CertificateTemplateVariableField = {
  variable: string;
  label: string;
  multiline: boolean;
};

const RESERVED_MANUAL_ISSUE_VARIABLES = new Set(["certificateNumber", "verificationUrl", "issueDate", "holderName"]);
const MULTILINE_TEMPLATE_VARIABLES = new Set(["capabilityTags"]);

function formatTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCertificateVariableLabel(locale: Locale, variable: string) {
  const labels: Record<string, { zh: string; en: string }> = {
    holderName: { zh: "证书持有人", en: "Certificate holder" },
    holderNameEn: { zh: "持有人英文名", en: "Holder name (EN)" },
    certificateName: { zh: "证书名称", en: "Certificate name" },
    certificateNameEn: { zh: "证书英文名", en: "Certificate name (EN)" },
    categoryName: { zh: "证书分类", en: "Certificate category" },
    categoryNameEn: { zh: "分类英文名", en: "Category name (EN)" },
    workName: { zh: "作品名称", en: "Work name" },
    workNameEn: { zh: "作品英文名", en: "Work name (EN)" },
    eventName: { zh: "活动名称", en: "Event name" },
    eventNameEn: { zh: "活动英文名", en: "Event name (EN)" },
    projectName: { zh: "项目名称", en: "Project name" },
    projectNameEn: { zh: "项目英文名", en: "Project name (EN)" },
    programName: { zh: "计划名称", en: "Program name" },
    programNameEn: { zh: "计划英文名", en: "Program name (EN)" },
    courseName: { zh: "课程名称", en: "Course name" },
    courseNameEn: { zh: "课程英文名", en: "Course name (EN)" },
    roleName: { zh: "角色", en: "Role" },
    roleNameEn: { zh: "角色英文名", en: "Role (EN)" },
    organizationName: { zh: "机构名称", en: "Organization name" },
    organizationNameEn: { zh: "机构英文名", en: "Organization name (EN)" },
    institutionName: { zh: "单位名称", en: "Institution name" },
    institutionNameEn: { zh: "单位英文名", en: "Institution name (EN)" },
    achievementName: { zh: "成就名称", en: "Achievement name" },
    achievementNameEn: { zh: "成就英文名", en: "Achievement name (EN)" },
    milestoneName: { zh: "里程碑名称", en: "Milestone name" },
    milestoneNameEn: { zh: "里程碑英文名", en: "Milestone name (EN)" },
    sessionName: { zh: "场次名称", en: "Session name" },
    sessionNameEn: { zh: "场次英文名", en: "Session name (EN)" },
    topicName: { zh: "主题名称", en: "Topic name" },
    topicNameEn: { zh: "主题英文名", en: "Topic name (EN)" },
    trackName: { zh: "赛道名称", en: "Track name" },
    trackNameEn: { zh: "赛道英文名", en: "Track name (EN)" },
    speakerName: { zh: "讲者姓名", en: "Speaker name" },
    speakerNameEn: { zh: "讲者英文名", en: "Speaker name (EN)" },
    mentorName: { zh: "导师姓名", en: "Mentor name" },
    mentorNameEn: { zh: "导师英文名", en: "Mentor name (EN)" },
    cohortName: { zh: "届别名称", en: "Cohort name" },
    cohortNameEn: { zh: "届别英文名", en: "Cohort name (EN)" },
    locationName: { zh: "地点", en: "Location" },
    locationNameEn: { zh: "地点英文名", en: "Location (EN)" },
    completionDate: { zh: "完成日期", en: "Completion date" },
    issuerName: { zh: "签发机构", en: "Issuer" },
    signer: { zh: "签字人", en: "Signer" },
    learningHours: { zh: "学习时长", en: "Learning hours" },
    capabilityTags: { zh: "能力标签", en: "Capability tags" },
  };

  return labels[variable]?.[locale === "zh" ? "zh" : "en"] ?? variable;
}

function getVisibleTemplateVariableFields(template: CertificateAdminTemplate | null, locale: Locale): CertificateTemplateVariableField[] {
  if (!template || !Array.isArray(template.renderConfig?.elements)) {
    return [];
  }

  const fields: CertificateTemplateVariableField[] = [];
  const seen = new Set<string>();

  for (const rawElement of template.renderConfig.elements as CertificateTemplateRenderElementInput[]) {
    if (!rawElement || rawElement.kind !== "VARIABLE" || rawElement.visible === false || typeof rawElement.variable !== "string") {
      continue;
    }

    const variable = rawElement.variable.trim();
    if (!variable || RESERVED_MANUAL_ISSUE_VARIABLES.has(variable) || seen.has(variable)) {
      continue;
    }

    seen.add(variable);
    fields.push({
      variable,
      label: rawElement.label?.trim() || getCertificateVariableLabel(locale, variable),
      multiline: MULTILINE_TEMPLATE_VARIABLES.has(variable),
    });
  }

  return fields;
}

function buildInitialManualVariableValues(template: CertificateAdminTemplate | null) {
  return {
    holderName: "",
    holderNameEn: "",
    certificateName: template?.definition?.name ?? template?.name ?? "",
    certificateNameEn: template?.definition?.nameEn ?? template?.nameEn ?? template?.definition?.name ?? template?.name ?? "",
    categoryName: template?.categoryName ?? "",
    categoryNameEn: template?.categoryNameEn ?? template?.categoryName ?? "",
    issuerName: template?.renderConfig?.issuerName ?? "",
    signer: template?.renderConfig?.signerName ?? template?.renderConfig?.issuerName ?? "",
    completionDate: "",
    learningHours: "",
    capabilityTags: "",
  } as Record<string, string>;
}

function normalizeManualVariablePayload(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value.trim().length > 0),
  );
}

function parseManualIssueEmails(value: string) {
  return Array.from(new Set(
    value
      .split(/[\n,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  ));
}

function isLikelyEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeIssuedVariableValues(values: Record<string, unknown> | null | undefined) {
  const normalized: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(values ?? {})) {
    if (Array.isArray(rawValue)) {
      normalized[key] = rawValue
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .join(", ");
      continue;
    }

    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    normalized[key] = String(rawValue).trim();
  }

  return normalized;
}

function decodeHtmlDataUrl(url: string | null | undefined) {
  if (!url || !url.startsWith("data:text/html")) {
    return null;
  }

  const commaIndex = url.indexOf(",");
  if (commaIndex < 0) {
    return null;
  }

  const payload = url.slice(commaIndex + 1);
  return decodeURIComponent(payload);
}

const CERTIFICATE_ISSUE_DRAFT_STORAGE_KEY = "certificate-issue-form-draft-v1";
const LOCALE_SWITCH_PRESERVE_STORAGE_KEY = "locale-switch-preserve-path-v1";

function getLocaleIndependentPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const knownLocales = new Set(["en", "zh", "fr", "de"]);
  const tail = knownLocales.has(segments[0]) ? segments.slice(1) : segments;
  return `/${tail.join("/")}`;
}

type CertificateIssueDraft = {
  mode: "single" | "batch";
  email: string;
  batchEmails: string;
  templateId: string;
  issueDate: string;
  batchIssueDate: string;
  editingIssueId?: string | null;
  editingCertificateNumber?: string;
  singleVariableValues: Record<string, string>;
  batchVariableValues: Record<string, string>;
};

function t(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

const certificateAdminSections = [
  { key: "dash", href: "/admin/certificates", zh: "证书总览", en: "Dashboard" },
  { key: "cats", href: "/admin/certificates/categories", zh: "分类管理", en: "Categories" },
  { key: "tpl", href: "/admin/certificates/templates", zh: "模板管理", en: "Templates" },
  { key: "rules", href: "/admin/certificates/rules", zh: "自动签发规则", en: "Issuing Rules" },
  { key: "issue", href: "/admin/certificates/issue", zh: "签发证书", en: "Issue Certificates" },
  { key: "apps", href: "/admin/certificates/applications", zh: "申请审核", en: "Applications" },
  { key: "recs", href: "/admin/certificates/records", zh: "证书记录", en: "Records" },
  { key: "logs", href: "/admin/certificates/audit-logs", zh: "验证与审计日志", en: "Audit Logs" },
];

function CertificateModuleNav({
  locale,
  breadcrumbOnly = false,
  hideSectionLinks = false,
}: {
  locale: Locale;
  breadcrumbOnly?: boolean;
  hideSectionLinks?: boolean;
}) {
  const pathname = usePathname();
  const prefix = `/${locale}`;
  const activeSection = certificateAdminSections.find((section) => pathname === `${prefix}${section.href}`) ?? certificateAdminSections[0];
  const adminHomeHref = `${prefix}/admin`;
  const certificateHomeHref = `${prefix}/admin/certificates`;
  const activeSectionHref = `${prefix}${activeSection.href}`;

  return (
    <div
      className={`cpca-module-nav${breadcrumbOnly ? " is-breadcrumb-only" : ""}`}
      aria-label={t(locale, "证书中心导航", "Certificate module navigation")}
    >
      <div className="cpca-breadcrumb">
        <Link className="cpca-breadcrumb-link" href={adminHomeHref}>
          {t(locale, "Climate Passport 管理首页", "Climate Passport Admin Home")}
        </Link>
        <span aria-hidden="true">›</span>
        <Link className="cpca-breadcrumb-link" href={certificateHomeHref}>
          {t(locale, "证书中心", "Certificates")}
        </Link>
        <span aria-hidden="true">›</span>
        <Link aria-current="page" className="cpca-breadcrumb-link is-current" href={activeSectionHref}>
          {t(locale, activeSection.zh, activeSection.en)}
        </Link>
      </div>
      {breadcrumbOnly || hideSectionLinks ? null : (
        <div className="cpca-section-links">
          {certificateAdminSections.map((section) => {
            const href = `${prefix}${section.href}`;
            return (
              <Link className={pathname === href ? "is-active" : undefined} href={href} key={section.key}>
                {t(locale, section.zh, section.en)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CertificateAdminFrame({
  locale,
  children,
  breadcrumbOnly = false,
  hideSectionLinks = false,
}: {
  locale: Locale;
  children: ReactNode;
  breadcrumbOnly?: boolean;
  hideSectionLinks?: boolean;
}) {
  return (
    <div className={`cpca${breadcrumbOnly ? " is-breadcrumb-only-layout" : ""}`}>
      <CertificateModuleNav locale={locale} breadcrumbOnly={breadcrumbOnly} hideSectionLinks={hideSectionLinks} />
      {children}
    </div>
  );
}

function localName(locale: Locale, item: { name: string; nameEn?: string | null }) {
  return locale === "zh" ? item.name : item.nameEn ?? item.name;
}

function localizeTemplateDeleteError(locale: Locale, message?: string) {
  if (!message) {
    return t(locale, "删除失败，请稍后重试。", "Delete failed. Please retry.");
  }

  const normalized = message.toLowerCase();
  if (normalized.includes("issued certificates") || normalized.includes("cannot be deleted")) {
    return t(locale, "该模板已有签发记录，无法删除。", "This template has issued certificates and cannot be deleted.");
  }

  if (normalized.includes("not found")) {
    return t(locale, "模板不存在或已被删除。", "Template not found or already deleted.");
  }

  if (normalized.includes("permissions")) {
    return t(locale, "权限不足，无法删除模板。", "Insufficient permissions to delete template.");
  }

  return message;
}

function localizeTemplateDuplicateError(locale: Locale, message?: string) {
  if (!message) {
    return t(locale, "复制失败，请稍后重试。", "Duplicate failed. Please retry.");
  }

  const normalized = message.toLowerCase();
  if (normalized.includes("related category") || normalized.includes("category")) {
    return t(locale, "关联分类不存在，无法复制模板。", "Related category is missing and template duplication failed.");
  }

  if (normalized.includes("insufficient permissions") || normalized.includes("permissions")) {
    return t(locale, "权限不足，无法复制模板。", "Insufficient permissions to duplicate template.");
  }

  return message;
}

function getTemplateLayoutLabel(locale: Locale, template: CertificateAdminTemplate) {
  const pageSize = template.renderConfig?.pageSize ?? "A4_LANDSCAPE";
  const width = template.renderConfig?.pageWidthMm;
  const height = template.renderConfig?.pageHeightMm;

  const preset = pageSize === "A4_PORTRAIT"
    ? t(locale, "A4 纵向", "A4 Portrait")
    : pageSize === "DIGITAL_CARD"
      ? t(locale, "数字卡片", "Digital Card")
      : t(locale, "A4 横向", "A4 Landscape");

  if (typeof width === "number" && typeof height === "number") {
    return `${preset} · ${Math.round(width)} x ${Math.round(height)} mm`;
  }

  return preset;
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("revoked") || normalized.includes("rejected") || normalized.includes("failed")) return "cpca-badge cpca-badge-red";
  if (normalized.includes("pending") || normalized.includes("draft") || normalized.includes("expired") || normalized.includes("processing") || normalized.includes("failure")) return "cpca-badge cpca-badge-amber";
  if (normalized.includes("needs")) return "cpca-badge cpca-badge-blue";
  return "cpca-badge cpca-badge-green";
}

function batchStatusLabel(locale: Locale, status: string) {
  switch (status) {
    case "PENDING": return t(locale, "待处理", "Pending");
    case "PROCESSING": return t(locale, "处理中", "Processing");
    case "COMPLETED": return t(locale, "已完成", "Completed");
    case "COMPLETED_WITH_FAILURES": return t(locale, "部分失败", "Completed with failures");
    case "FAILED": return t(locale, "失败", "Failed");
    default: return status;
  }
}

function batchItemStatusLabel(locale: Locale, status: string) {
  switch (status) {
    case "PENDING": return t(locale, "待处理", "Pending");
    case "PROCESSING": return t(locale, "处理中", "Processing");
    case "SUCCEEDED": return t(locale, "成功", "Succeeded");
    case "FAILED": return t(locale, "失败", "Failed");
    default: return status;
  }
}

function batchSourceLabel(locale: Locale, source: string, activity?: { title: string; titleEn?: string | null } | null) {
  if (source === "ACTIVITY_ELIGIBLE_LIST") {
    return activity ? localName(locale, { name: activity.title, nameEn: activity.titleEn }) : t(locale, "活动合格名单", "Activity eligible list");
  }
  if (source === "CSV") {
    return t(locale, "CSV 名单", "CSV list");
  }
  return t(locale, "手动名单", "Manual list");
}

function StatusBadge({ children, status }: { children: string; status: string }) {
  return <span className={statusClass(status)}><span className="cpca-dot" />{children}</span>;
}

function PageHead({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="cpca-page-head">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Card({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="cpca-card">
      {title ? <div className="cpca-card-head"><h2>{title}</h2></div> : null}
      <div className="cpca-card-body">{children}</div>
      {footer ? <div className="cpca-card-foot">{footer}</div> : null}
    </section>
  );
}

function Metric({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: "up" | "down" }) {
  return (
    <article className="cpca-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small className={tone === "down" ? "is-down" : "is-up"}>{note}</small> : null}
    </article>
  );
}

export function CertificateAdminDashboard({
  locale,
  categories,
  templates,
  issues,
}: {
  locale: Locale;
  categories: CertificateAdminCategory[];
  templates: CertificateAdminTemplate[];
  issues: CertificateAdminIssue[];
}) {
  const issued = issues.filter((issue) => !issue.status.toLowerCase().includes("revoked")).length;
  const pending = issues.filter((issue) => issue.status.toLowerCase().includes("pending") || issue.status.toLowerCase().includes("draft")).length;
  const activeTemplates = templates.filter((template) => template.isActive).length;
  const recent = issues.slice(0, 5);
  const popular = categories.slice(0, 6);

  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead
        title={t(locale, "证书管理总览", "Certificate Dashboard")}
        description={t(locale, "总览证书系统运行、签发、模板和异常验证情况。", "Overview of credential system activity and metrics.")}
      />
      <div className="cpca-stats">
        <Metric label={t(locale, "证书总数", "Total Certificates")} value={issues.length} note={t(locale, "当前数据库记录", "Current records")} />
        <Metric label={t(locale, "本月新增", "This Month")} value={issued} note={t(locale, "已签发记录", "Issued records")} />
        <Metric label={t(locale, "待审核", "Pending Review")} value={pending} note={t(locale, "需要处理", "Needs attention")} tone="down" />
        <Metric label={t(locale, "活跃模板", "Active Templates")} value={activeTemplates} note={`${categories.length} ${t(locale, "个分类", "categories")}`} />
      </div>
      <div className="cpca-dashboard-grid">
        <div>
          <Card title={t(locale, "热门证书类型", "Popular Certificate Types")}>
            <div className="cpca-bars">
              {popular.map((category, index) => {
                const count = category.templateCount ?? Math.max(1, 12 - index * 2);
                const width = Math.max(12, Math.min(92, count * 18));
                return (
                  <div className="cpca-bar-row" key={category.id}>
                    <span>{localName(locale, category)}</span>
                    <div><i style={{ width: `${width}%` }} /></div>
                    <strong>{count}</strong>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title={t(locale, "最近签发记录", "Recent Issuances")}>
            <div className="cpca-table-wrap">
              <table className="cpca-table">
                <thead><tr><th>{t(locale, "持有人", "Recipient")}</th><th>{t(locale, "证书", "Certificate")}</th><th>{t(locale, "日期", "Date")}</th><th>{t(locale, "状态", "Status")}</th></tr></thead>
                <tbody>
                  {recent.map((issue) => (
                    <tr key={issue.id}><td className="cpca-strong">{issue.holderName}</td><td>{issue.certificateName}</td><td>{issue.issueDate}</td><td><StatusBadge status={issue.status}>{issue.status}</StatusBadge></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div>
          <Card title={t(locale, "异常验证记录", "Anomalous Verifications")}>
            <div className="cpca-feed">
              <article><span>!</span><p><strong>{t(locale, "同一来源高频验证", "Multiple rapid verifications")}</strong><small>12 requests in 2 min · Today</small></p></article>
              <article><span className="danger">×</span><p><strong>{t(locale, "已撤销证书被访问", "Revoked certificate accessed")}</strong><small>Certificate verification · 5 hours ago</small></p></article>
              <article><span>!</span><p><strong>{t(locale, "过期证书访问频繁", "Expired certificate accessed repeatedly")}</strong><small>15+ attempts · Today</small></p></article>
            </div>
          </Card>
          <Card title={t(locale, "快捷操作", "Quick Actions")}>
            <div className="cpca-quick-grid">
              <Link href={`/${locale}/admin/certificates/issue`}><span>Issue</span><strong>{t(locale, "签发证书", "Issue Certificate")}</strong><small>{t(locale, "单个或批量签发", "Single or batch issue")}</small></Link>
              <Link href={`/${locale}/admin/certificates/applications`}><span>Review</span><strong>{t(locale, "申请审核", "Applications")}</strong><small>{t(locale, "处理待审请求", "Review pending requests")}</small></Link>
              <Link href={`/${locale}/admin/certificates/templates`}><span>Create</span><strong>{t(locale, "新建模板", "New Template")}</strong><small>{t(locale, "配置证书版式", "Design new credential")}</small></Link>
            </div>
          </Card>
        </div>
      </div>
    </CertificateAdminFrame>
  );
}

export function CertificateAdminCategories({
  locale,
  categories,
  form,
}: {
  locale: Locale;
  categories: CertificateAdminCategory[];
  form: (selectedCategory: CertificateAdminCategory | null, clearSelection: () => void) => ReactNode;
}) {
  const router = useRouter();
  const rows = categories;
  const [sortMode, setSortMode] = useState<"latest" | "most-issued">("latest");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CertificateAdminCategory | null>(null);
  const [categoryActionId, setCategoryActionId] = useState<string | null>(null);
  const [categoryActionError, setCategoryActionError] = useState("");

  async function changeCategoryState(category: CertificateAdminCategory, isActive: boolean) {
    const dependencyText = `${category.templateCount ?? 0} ${t(locale, "个模板", "templates")} / ${category.definitionCount ?? 0} ${t(locale, "个定义", "definitions")} / ${category.issuedCount ?? 0} ${t(locale, "份已签发", "issued")}`;
    if (!window.confirm(isActive ? t(locale, `确认启用此分类？关联项不会自动启用。\n${dependencyText}`, `Activate this category? Dependents will remain unchanged.\n${dependencyText}`) : t(locale, `确认停用此分类？必须先停用活跃模板和定义。\n${dependencyText}`, `Deactivate this category? Active templates and definitions must be disabled first.\n${dependencyText}`))) return;
    setCategoryActionId(category.id); setCategoryActionError("");
    try { const response = await fetch("/api/admin/certificates/categories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: category.id, isActive }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setCategoryActionError(result.error ?? t(locale, "操作失败。", "Action failed.")); return; } router.refresh(); } catch { setCategoryActionError(t(locale, "网络错误。", "Network error.")); } finally { setCategoryActionId(null); }
  }
  async function deleteCategory(category: CertificateAdminCategory) {
    if ((category.templateCount ?? 0) || (category.definitionCount ?? 0)) { setCategoryActionError(t(locale, "该分类仍有关联模板或定义，不能删除。", "This category still has templates or definitions and cannot be deleted.")); return; }
    if (!window.confirm(t(locale, "确认删除此空分类？此操作不可恢复。", "Delete this empty category? This cannot be undone."))) return;
    setCategoryActionId(category.id); setCategoryActionError("");
    try { const response = await fetch("/api/admin/certificates/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: category.id }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setCategoryActionError(result.error ?? t(locale, "删除失败。", "Delete failed.")); return; } router.refresh(); } catch { setCategoryActionError(t(locale, "网络错误。", "Network error.")); } finally { setCategoryActionId(null); }
  }

  // When the categories list is updated (e.g. after a save), sync selectedCategory
  // so the edit form reflects the latest saved data.
  useEffect(() => {
    setSelectedCategory((prev) => {
      if (!prev) return prev;
      const updated = categories.find((c) => c.id === prev.id);
      return updated ?? prev;
    });
  }, [categories]);
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredRows = rows.filter((category) => {
    if (!normalizedKeyword) {
      return true;
    }

    const localizedName = localName(locale, category).toLowerCase();
    return (
      category.key.toLowerCase().includes(normalizedKeyword)
      || category.name.toLowerCase().includes(normalizedKeyword)
      || (category.nameEn ?? "").toLowerCase().includes(normalizedKeyword)
      || localizedName.includes(normalizedKeyword)
    );
  });
  const sortedRows = [...filteredRows]
    .sort((left, right) => {
      if (sortMode === "most-issued") {
        const issueDelta = (right.issuedCount ?? 0) - (left.issuedCount ?? 0);
        if (issueDelta !== 0) {
          return issueDelta;
        }
        return (left.order ?? 0) - (right.order ?? 0);
      }

      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return (left.order ?? 0) - (right.order ?? 0);
    })
    .slice(0, 5);

  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead
        title={t(locale, "证书分类管理", "Certificate Categories")}
        description={t(locale, "管理证书类型，以及自动签发、用户申请、PDF 下载和公开验证能力。", "Manage credential types and their configurations.")}
        action={
          <a
            className="cpca-btn cpca-btn-amber"
            href="#category-form"
            onClick={() => setSelectedCategory(null)}
          >
            + {t(locale, "新增分类", "New Category")}
          </a>
        }
      />
      <div className="cpca-filter-row">
        <label>
          <input
            aria-label={t(locale, "搜索分类", "Search categories")}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder={t(locale, "按分类 Key 或名称搜索", "Search by category key or name")}
            type="search"
            value={searchKeyword}
          />
        </label>
        <label className="cpca-filter-right">
          <select aria-label={t(locale, "分类列表排序方式", "Category list sort mode")} onChange={(event) => setSortMode(event.target.value as "latest" | "most-issued")} value={sortMode}>
            <option value="latest">{t(locale, "最新（Top 5）", "Latest (Top 5)")}</option>
            <option value="most-issued">{t(locale, "发证书最多（Top 5）", "Most issued (Top 5)")}</option>
          </select>
        </label>
      </div>
      {categoryActionError ? <FormErrorText>{categoryActionError}</FormErrorText> : null}
      <Card>
        <div className="cpca-table-wrap">
          <table className="cpca-table">
            <thead><tr><th>{t(locale, "分类", "Category")}</th><th>{t(locale, "名称", "Name")}</th><th>{t(locale, "已签发", "Issued")}</th><th>{t(locale, "自动签发", "Auto-Issue")}</th><th>{t(locale, "用户申请", "User Request")}</th><th>PDF</th><th>{t(locale, "公开验证", "Public Verify")}</th><th>{t(locale, "状态", "Status")}</th><th>{t(locale, "操作", "Actions")}</th></tr></thead>
            <tbody>
              {sortedRows.map((category) => (
                <tr key={category.id}>
                  <td className="cpca-strong">{category.key}</td>
                  <td>{localName(locale, category)}</td>
                  <td>{category.issuedCount ?? 0}</td>
                  <td><input checked={Boolean(category.autoIssueEnabled)} readOnly type="checkbox" /></td>
                  <td><input checked={Boolean(category.userRequestEnabled)} readOnly type="checkbox" /></td>
                  <td><input checked={Boolean(category.pdfEnabled)} readOnly type="checkbox" /></td>
                  <td><input checked={Boolean(category.publicVerifyEnabled)} readOnly type="checkbox" /></td>
                  <td><StatusBadge status={category.isActive ? "Active" : "Inactive"}>{category.isActive ? "Active" : "Inactive"}</StatusBadge></td>
                  <td>
                    <button className="cpca-btn cpca-btn-ghost" onClick={() => setSelectedCategory(category)} type="button">
                      {t(locale, "编辑", "Edit")}
                    </button>
                    <button className="cpca-btn cpca-btn-ghost" disabled={categoryActionId === category.id} onClick={() => void changeCategoryState(category, !category.isActive)} type="button">{categoryActionId === category.id ? t(locale, "处理中...", "Working...") : category.isActive ? t(locale, "停用", "Deactivate") : t(locale, "启用", "Activate")}</button>
                    {(category.templateCount ?? 0) === 0 && (category.definitionCount ?? 0) === 0 ? <button className="cpca-btn cpca-btn-danger" disabled={categoryActionId === category.id} onClick={() => void deleteCategory(category)} type="button">{t(locale, "删除", "Delete")}</button> : null}
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 ? (
                <tr>
                  <td className="cpca-muted" colSpan={9}>
                    {t(locale, "未找到匹配分类。", "No matching categories found.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      <section className="cpca-card cpca-form-card" id="category-form">
        <div className="cpca-card-head">
          <h2>{selectedCategory ? t(locale, "编辑分类", "Edit Category") : t(locale, "新增分类", "Create Category")}</h2>
        </div>
        <div className="cpca-card-body">{form(selectedCategory, () => setSelectedCategory(null))}</div>
      </section>
    </CertificateAdminFrame>
  );
}

export function CertificateAdminTemplates({
  locale,
  templates,
  form,
}: {
  locale: Locale;
  templates: CertificateAdminTemplate[];
  form: (selectedTemplate: CertificateAdminTemplate | null, clearSelection: () => void) => ReactNode;
}) {
  const router = useRouter();
  const rows = templates;
  const [sortMode, setSortMode] = useState<"latest" | "most-issued">("latest");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateAdminTemplate | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [duplicatingTemplateId, setDuplicatingTemplateId] = useState<string | null>(null);
  const [listMessage, setListMessage] = useState("");
  const [listError, setListError] = useState("");
  const [previewingTemplate, setPreviewingTemplate] = useState<CertificateAdminTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const originalPageTitleRef = useRef("");
  const restoreTitleTimerRef = useRef<number | null>(null);
  const printTitleActiveRef = useRef(false);
  const normalizedKeyword = searchKeyword.trim().toLowerCase();

  const filteredRows = rows.filter((template) => {
    if (!normalizedKeyword) {
      return true;
    }

    return (
      template.name.toLowerCase().includes(normalizedKeyword)
      || (template.nameEn ?? "").toLowerCase().includes(normalizedKeyword)
      || (template.categoryName ?? "").toLowerCase().includes(normalizedKeyword)
      || (template.categoryNameEn ?? "").toLowerCase().includes(normalizedKeyword)
      || template.templateType.toLowerCase().includes(normalizedKeyword)
    );
  });

  const sortedRows = [...filteredRows]
    .sort((left, right) => {
      if (sortMode === "most-issued") {
        const issueDelta = (right.issuedCount ?? 0) - (left.issuedCount ?? 0);
        if (issueDelta !== 0) {
          return issueDelta;
        }
        return right.version - left.version;
      }

      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return right.version - left.version;
    })
    .slice(0, 6);

  const visibleRows = sortedRows;

  async function handleDeleteTemplate(template: CertificateAdminTemplate) {
    const confirmed = window.confirm(
      t(locale, "确认删除该模板？删除后不可恢复。", "Delete this template? This action cannot be undone."),
    );
    if (!confirmed) {
      return;
    }

    setDeletingTemplateId(template.id);
    setListError("");

    try {
      const response = await fetch("/api/admin/certificates/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id }),
      });

      let result: { error?: string } = {};
      const responseType = response.headers.get("content-type") ?? "";
      if (responseType.includes("application/json")) {
        result = (await response.json()) as { error?: string };
      } else if (!response.ok) {
        const rawError = await response.text();
        if (rawError.trim()) {
          result.error = rawError;
        }
      }

      if (!response.ok) {
        setListError(localizeTemplateDeleteError(locale, result.error));
        return;
      }

      router.refresh();
    } catch {
      setListError(t(locale, "网络错误。", "Network error."));
    } finally {
      setDeletingTemplateId(null);
    }
  }

  async function handleDuplicateTemplate(template: CertificateAdminTemplate) {
    setDuplicatingTemplateId(template.id);
    setListMessage("");
    setListError("");

    try {
      const response = await fetch(`/api/admin/certificates/templates/${template.id}/copy`, {
        method: "POST",
      });

      let result: {
        error?: string;
        template?: {
          id: string;
          name: string;
          nameEn?: string | null;
          templateType: string;
          isActive: boolean;
          version: number;
        };
        definition?: {
          name: string;
          nameEn?: string | null;
          approvalMode?: string | null;
        };
      } = {};
      const responseType = response.headers.get("content-type") ?? "";
      if (responseType.includes("application/json")) {
        result = (await response.json()) as {
          error?: string;
          template?: {
            id: string;
            name: string;
            nameEn?: string | null;
            templateType: string;
            isActive: boolean;
            version: number;
          };
          definition?: {
            name: string;
            nameEn?: string | null;
            approvalMode?: string | null;
          };
        };
      } else if (!response.ok) {
        const rawError = await response.text();
        if (rawError.trim()) {
          result.error = rawError;
        }
      }

      if (!response.ok) {
        setListError(localizeTemplateDuplicateError(locale, result.error));
        return;
      }

      if (result.template) {
        setSelectedTemplate({
          id: result.template.id,
          categoryId: template.categoryId,
          name: result.template.name,
          nameEn: result.template.nameEn,
          templateType: result.template.templateType,
          isActive: result.template.isActive,
          version: result.template.version,
          updatedAt: new Date().toISOString(),
          categoryName: template.categoryName,
          categoryNameEn: template.categoryNameEn,
          issuedCount: 0,
          renderConfig: template.renderConfig,
          definition: result.definition
            ? {
                name: result.definition.name,
                nameEn: result.definition.nameEn,
                approvalMode: result.definition.approvalMode,
              }
            : template.definition,
        });
      }

      setListMessage(t(locale, "模板已复制并已禁用，请在审核后再启用。", "Template copied and disabled; review it before enabling."));
      window.location.hash = "template-editor";
      router.refresh();
    } catch {
      setListError(t(locale, "网络错误。", "Network error."));
    } finally {
      setDuplicatingTemplateId(null);
    }
  }

  async function openTemplatePreview(template: CertificateAdminTemplate) {
    setPreviewingTemplate(template);
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewHtml("");

    try {
      const response = await fetch("/api/admin/certificates/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          name: template.name,
          nameEn: template.nameEn ?? null,
          categoryName: template.categoryName ?? null,
          categoryNameEn: template.categoryNameEn ?? null,
          holderName: locale === "zh" ? "证书持有人" : "Credential Holder",
          certificateNumber: "CV-PREVIEW",
          renderConfig: template.renderConfig ?? null,
        }),
      });

      let result: { error?: string; html?: string } = {};
      const responseType = response.headers.get("content-type") ?? "";
      if (responseType.includes("application/json")) {
        result = (await response.json()) as { error?: string; html?: string };
      }

      if (!response.ok) {
        setPreviewError(result.error ?? t(locale, "预览生成失败。", "Failed to generate preview."));
        return;
      }

      setPreviewHtml(result.html ?? "");
    } catch {
      setPreviewError(t(locale, "网络错误。", "Network error."));
    } finally {
      setPreviewLoading(false);
    }
  }

  function closeTemplatePreview() {
    setPreviewingTemplate(null);
    setPreviewHtml("");
    setPreviewError("");
    setPreviewLoading(false);
  }

  useEffect(() => {
    if (!previewingTemplate) {
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTemplatePreview();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [previewingTemplate]);

  useEffect(() => {
    originalPageTitleRef.current = document.title;

    const restoreTitle = () => {
      if (!printTitleActiveRef.current) {
        return;
      }
      document.title = originalPageTitleRef.current;
      printTitleActiveRef.current = false;
      if (restoreTitleTimerRef.current !== null) {
        window.clearTimeout(restoreTitleTimerRef.current);
        restoreTitleTimerRef.current = null;
      }
    };

    const handlePreviewPrintTitle = (event: MessageEvent) => {
      const payload = event.data as { type?: string; title?: unknown };
      if (!payload || payload.type !== "certificate-preview-title") {
        return;
      }

      const nextTitle = typeof payload.title === "string" ? payload.title.trim() : "";
      if (!nextTitle) {
        return;
      }

      document.title = nextTitle;
      printTitleActiveRef.current = true;
      if (restoreTitleTimerRef.current !== null) {
        window.clearTimeout(restoreTitleTimerRef.current);
      }
      restoreTitleTimerRef.current = window.setTimeout(() => {
        restoreTitle();
      }, 120000);
    };

    window.addEventListener("message", handlePreviewPrintTitle);
    window.addEventListener("afterprint", restoreTitle);
    return () => {
      window.removeEventListener("message", handlePreviewPrintTitle);
      window.removeEventListener("afterprint", restoreTitle);
      if (restoreTitleTimerRef.current !== null) {
        window.clearTimeout(restoreTitleTimerRef.current);
      }
      restoreTitle();
    };
  }, []);

  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead
        title={t(locale, "证书模板管理", "Certificate Templates")}
        description={t(locale, "设计和管理证书背景、变量、签名、印章、二维码和打印版式。", "Design and manage credential templates.")}
        action={<a className="cpca-btn cpca-btn-amber" href="#template-editor" onClick={() => setSelectedTemplate(null)}>+ {t(locale, "新增模板", "New Template")}</a>}
      />
      <div className="cpca-filter-row">
        <label>
          <input
            aria-label={t(locale, "搜索模板", "Search templates")}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder={t(locale, "按模板名或分类搜索", "Search by template or category")}
            type="search"
            value={searchKeyword}
          />
        </label>
        <label className="cpca-filter-right">
          <select aria-label={t(locale, "模板列表排序方式", "Template list sort mode")} onChange={(event) => setSortMode(event.target.value as "latest" | "most-issued")} value={sortMode}>
            <option value="latest">{t(locale, "最新（Top 6）", "Latest (Top 6)")}</option>
            <option value="most-issued">{t(locale, "签发最多（Top 6）", "Most issued (Top 6)")}</option>
          </select>
        </label>
      </div>
      {listMessage ? <FormSuccessText>{listMessage}</FormSuccessText> : null}
      {listError ? <FormErrorText>{listError}</FormErrorText> : null}
      <div className="cpca-template-grid">
        {visibleRows.map((template, index) => (
          <article className="cpca-template-card" key={template.id}>
            <div className={`cpca-template-thumb tone-${index % 6}`}><div>{template.templateType === "ACHIEVEMENT" ? "Badge" : template.templateType === "CUSTOM" ? "Digital Card" : "A4 Landscape"}</div></div>
            <div className="cpca-template-body">
              <h3>{localName(locale, template)}</h3>
              <div className="cpca-template-meta"><StatusBadge status={template.isActive ? "Active" : "Inactive"}>{template.isActive ? "Active" : "Inactive"}</StatusBadge><span>v{template.version}</span><span>{template.nameEn ? "EN/ZH" : "ZH"}</span><span>{getTemplateLayoutLabel(locale, template)}</span></div>
              <small>{template.issuedCount ?? 0} {t(locale, "已签发", "issued")}</small>
              <div className="cpca-actions"><button className="cpca-btn cpca-btn-outline" onClick={() => setSelectedTemplate(template)} type="button">{t(locale, "编辑", "Edit")}</button><button className="cpca-btn cpca-btn-ghost" onClick={() => void openTemplatePreview(template)} type="button">{t(locale, "预览", "Preview")}</button><button className="cpca-btn cpca-btn-ghost" disabled={duplicatingTemplateId === template.id} onClick={() => void handleDuplicateTemplate(template)} type="button">{duplicatingTemplateId === template.id ? t(locale, "复制中...", "Duplicating...") : t(locale, "复制", "Duplicate")}</button><button className="cpca-btn cpca-btn-danger" disabled={deletingTemplateId === template.id} onClick={() => void handleDeleteTemplate(template)} type="button">{deletingTemplateId === template.id ? t(locale, "删除中...", "Deleting...") : t(locale, "删除", "Delete")}</button></div>
            </div>
          </article>
        ))}
      </div>
      {visibleRows.length === 0 ? <FormHelpText>{t(locale, "未找到匹配模板。", "No matching templates found.")}</FormHelpText> : null}
      <section className="cpca-card cpca-form-card" id="template-editor">
        <div className="cpca-card-head"><h2>{selectedTemplate ? t(locale, "编辑模板", "Edit Template") : t(locale, "模板编辑器", "Template Editor")}</h2></div>
        <div className="cpca-card-body">{form(selectedTemplate, () => setSelectedTemplate(null))}</div>
      </section>
      {previewingTemplate ? (
        <div className="cpca-preview-modal" onClick={closeTemplatePreview} role="presentation">
          <div className="cpca-preview-modal-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={t(locale, "模板预览", "Template preview")}>
            <div className="cpca-preview-modal-head">
              <div>
                <strong>{localName(locale, previewingTemplate)}</strong>
                <small>{getTemplateLayoutLabel(locale, previewingTemplate)}</small>
              </div>
              <button className="cpca-btn cpca-btn-ghost" onClick={closeTemplatePreview} type="button">
                {t(locale, "关闭", "Close")}
              </button>
            </div>
            <div className="cpca-preview-modal-body">
              {previewLoading ? <FormHelpText>{t(locale, "预览生成中...", "Rendering preview...")}</FormHelpText> : null}
              {previewError ? <FormErrorText>{previewError}</FormErrorText> : null}
              {!previewLoading && !previewError && previewHtml ? (
                <iframe className="cpca-preview-modal-frame" sandbox="allow-scripts allow-modals" srcDoc={previewHtml} title={t(locale, "模板预览", "Template preview")} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </CertificateAdminFrame>
  );
}

export function CertificateAdminIssue({
  locale,
  templates,
  recentIssues,
  initialBatches = [],
}: {
  locale: Locale;
  templates: CertificateAdminTemplate[];
  recentIssues: CertificateAdminIssue[];
  initialBatches?: CertificateAdminBatch[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [email, setEmail] = useState("");
  const [batchEmails, setBatchEmails] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [batchMessage, setBatchMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [holderName, setHolderName] = useState("");
  const [editingCertificateNumber, setEditingCertificateNumber] = useState("");
  const [autoFilledHolderName, setAutoFilledHolderName] = useState("");
  const [recipientLookupLoading, setRecipientLookupLoading] = useState(false);
  const [issueDate, setIssueDate] = useState(formatTodayIsoDate());
  const [batchIssueDate, setBatchIssueDate] = useState(formatTodayIsoDate());
  const activeTemplates = templates.filter((template) => template.isActive);
  const selectedTemplate = activeTemplates.find((template) => template.id === templateId) ?? null;
  const templateVariableFields = getVisibleTemplateVariableFields(selectedTemplate, locale);
  const [singleVariableValues, setSingleVariableValues] = useState<Record<string, string>>({});
  const [batchVariableValues, setBatchVariableValues] = useState<Record<string, string>>({});
  const [batchSource, setBatchSource] = useState<"MANUAL_LIST" | "ACTIVITY_ELIGIBLE_LIST">("MANUAL_LIST");
  const [batchActivityId, setBatchActivityId] = useState("");
  const [batchActivityOptions, setBatchActivityOptions] = useState<CertificateBatchActivityOption[]>([]);
  const [batchActivityLoading, setBatchActivityLoading] = useState(false);
  const [batchNotify, setBatchNotify] = useState(true);
  const [batchPreflightReport, setBatchPreflightReport] = useState<CertificateBatchPreflightReport | null>(null);
  const [batchPreflightLoading, setBatchPreflightLoading] = useState(false);
  const [batchIdempotencyKey, setBatchIdempotencyKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `batch-${Date.now()}`));
  const [batchList, setBatchList] = useState<CertificateAdminBatch[]>(initialBatches);
  const [activeBatch, setActiveBatch] = useState<CertificateAdminBatch | null>(null);
  const [batchDetailItems, setBatchDetailItems] = useState<CertificateAdminBatchItem[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const batchPollTimer = useRef<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDialogTitle, setPreviewDialogTitle] = useState("");
  const [previewDialogSubtitle, setPreviewDialogSubtitle] = useState("");
  const [issueFeedbackOpen, setIssueFeedbackOpen] = useState(false);
  const [issueFeedbackKind, setIssueFeedbackKind] = useState<"success" | "error">("success");
  const [issueFeedbackMessage, setIssueFeedbackMessage] = useState("");
  const [recordActionLoadingId, setRecordActionLoadingId] = useState<string | null>(null);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const holderNameRef = useRef(holderName);
  const autoFilledHolderNameRef = useRef(autoFilledHolderName);
  const recipientLookupRequestId = useRef(0);

  function clearIssueDraftStorage() {
    try {
      window.sessionStorage.removeItem(CERTIFICATE_ISSUE_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage write errors.
    }
  }

  function resetSingleIssueForm(options?: { clearMessage?: boolean }) {
    setEmail("");
    setTemplateId("");
    setHolderName("");
    setAutoFilledHolderName("");
    setRecipientLookupLoading(false);
    setIssueDate(formatTodayIsoDate());
    setSingleVariableValues(buildInitialManualVariableValues(null));
    setEditingIssueId(null);
    setEditingCertificateNumber("");
    setPreviewOpen(false);
    setPreviewHtml("");
    setPreviewError("");
    setPreviewDialogTitle("");
    setPreviewDialogSubtitle("");

    if (options?.clearMessage ?? true) {
      setMessage("");
    }

    clearIssueDraftStorage();
  }

  function openIssueFeedback(kind: "success" | "error", messageText: string) {
    setIssueFeedbackKind(kind);
    setIssueFeedbackMessage(messageText);
    setIssueFeedbackOpen(true);
  }

  function closeIssueFeedbackModal() {
    setIssueFeedbackOpen(false);
    setIssueFeedbackMessage("");
  }

  useEffect(() => {
    holderNameRef.current = holderName;
  }, [holderName]);

  useEffect(() => {
    autoFilledHolderNameRef.current = autoFilledHolderName;
  }, [autoFilledHolderName]);

  useEffect(() => {
    const defaults = buildInitialManualVariableValues(selectedTemplate);
    setSingleVariableValues((previous) => ({ ...defaults, ...previous }));
    setBatchVariableValues((previous) => ({ ...defaults, ...previous }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate?.id]);

  useEffect(() => {
    if (hasRestoredDraft) {
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(CERTIFICATE_ISSUE_DRAFT_STORAGE_KEY);
      if (!raw) {
        setHasRestoredDraft(true);
        return;
      }

      const draft = JSON.parse(raw) as Partial<CertificateIssueDraft>;
      if (draft.mode === "single" || draft.mode === "batch") {
        setMode(draft.mode);
      }
      if (typeof draft.email === "string") {
        setEmail(draft.email);
      }
      if (typeof draft.batchEmails === "string") {
        setBatchEmails(draft.batchEmails);
      }
      if (typeof draft.templateId === "string") {
        setTemplateId(draft.templateId);
      }
      if (typeof draft.issueDate === "string") {
        setIssueDate(draft.issueDate);
      }
      if (typeof draft.batchIssueDate === "string") {
        setBatchIssueDate(draft.batchIssueDate);
      }
      if (typeof draft.editingIssueId === "string") {
        setEditingIssueId(draft.editingIssueId);
      }
      if (typeof draft.editingCertificateNumber === "string") {
        setEditingCertificateNumber(draft.editingCertificateNumber);
      }
      if (draft.singleVariableValues && typeof draft.singleVariableValues.holderName === "string") {
        setHolderName(draft.singleVariableValues.holderName);
        setAutoFilledHolderName("");
      }
      if (draft.singleVariableValues && typeof draft.singleVariableValues === "object") {
        setSingleVariableValues((previous) => ({ ...previous, ...draft.singleVariableValues }));
      }
      if (draft.batchVariableValues && typeof draft.batchVariableValues === "object") {
        setBatchVariableValues((previous) => ({ ...previous, ...draft.batchVariableValues }));
      }
    } catch {
      // Ignore invalid persisted drafts.
    } finally {
      setHasRestoredDraft(true);
    }
  }, [hasRestoredDraft]);

  useEffect(() => {
    return () => {
      try {
        const preservedPath = window.sessionStorage.getItem(LOCALE_SWITCH_PRESERVE_STORAGE_KEY);
        if (preservedPath === getLocaleIndependentPath(pathname)) {
          window.sessionStorage.removeItem(LOCALE_SWITCH_PRESERVE_STORAGE_KEY);
          return;
        }
      } catch {
        // Ignore storage read errors.
      }

      clearIssueDraftStorage();
    };
  }, [pathname]);

  useEffect(() => {
    if (!hasRestoredDraft) {
      return;
    }

    const draft: CertificateIssueDraft = {
      mode,
      email,
      batchEmails,
      templateId,
      issueDate,
      batchIssueDate,
      editingIssueId,
      editingCertificateNumber,
      singleVariableValues,
      batchVariableValues,
    };

    try {
      window.sessionStorage.setItem(CERTIFICATE_ISSUE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage write errors.
    }
  }, [
    hasRestoredDraft,
    mode,
    email,
    batchEmails,
    templateId,
    issueDate,
    batchIssueDate,
    editingIssueId,
    editingCertificateNumber,
    singleVariableValues,
    batchVariableValues,
  ]);

  useEffect(() => {
    if (mode !== "single") {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isLikelyEmailAddress(normalizedEmail)) {
      setRecipientLookupLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = recipientLookupRequestId.current + 1;
      recipientLookupRequestId.current = requestId;
      setRecipientLookupLoading(true);

      try {
        const response = await fetch(`/api/admin/certificates/recipient?email=${encodeURIComponent(normalizedEmail)}`, {
          cache: "no-store",
        });
        const result = response.ok
          ? await response.json() as { found?: boolean; user?: { name?: string | null } }
          : null;

        if (recipientLookupRequestId.current !== requestId) {
          return;
        }

        const matchedHolderName = result?.found ? result.user?.name?.trim() ?? "" : "";
        if (!matchedHolderName) {
          setAutoFilledHolderName("");
          return;
        }

        const currentHolderName = holderNameRef.current.trim();
        const currentAutoFilledHolderName = autoFilledHolderNameRef.current.trim();
        const shouldAutofill = !currentHolderName || currentHolderName === currentAutoFilledHolderName;

        if (!shouldAutofill) {
          return;
        }

        setHolderName(matchedHolderName);
        setSingleVariableValues((previous) => ({ ...previous, holderName: matchedHolderName }));
        setAutoFilledHolderName(matchedHolderName);
      } catch {
        if (recipientLookupRequestId.current === requestId) {
          setAutoFilledHolderName("");
        }
      } finally {
        if (recipientLookupRequestId.current === requestId) {
          setRecipientLookupLoading(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [mode, email]);

  function renderVariableInputs(values: Record<string, string>, setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>) {
    if (!selectedTemplate) {
      return <FormHelpText>{t(locale, "请选择模板后填写变量。", "Select a template to fill variable fields.")}</FormHelpText>;
    }

    if (templateVariableFields.length === 0) {
      return <FormHelpText>{t(locale, "当前模板没有可手动填写的可见变量。", "This template has no visible variables for manual input.")}</FormHelpText>;
    }

    return (
      <div className="cpca-variable-fields-section">
        <div className="cpca-form-grid">
          {templateVariableFields.map((field) => (
            <label className={field.multiline ? "wide" : undefined} key={field.variable}>
              <FieldLabelWithInfo label={field.label} tooltip={field.variable} />
              {field.multiline ? (
                <textarea
                  onChange={(event) => setValues((previous) => ({ ...previous, [field.variable]: event.target.value }))}
                  placeholder={field.variable === "capabilityTags" ? t(locale, "多个标签请用逗号分隔", "Separate multiple tags with commas") : ""}
                  rows={3}
                  value={values[field.variable] ?? ""}
                />
              ) : (
                <input
                  onChange={(event) => setValues((previous) => ({ ...previous, [field.variable]: event.target.value }))}
                  type={field.variable.toLowerCase().includes("date") ? "date" : "text"}
                  value={values[field.variable] ?? ""}
                />
              )}
            </label>
          ))}
        </div>
      </div>
    );
  }

  function buildPreviewPayload(values: Record<string, string>, currentIssueDate: string) {
    if (!selectedTemplate) {
      return null;
    }

    const manualValues = normalizeManualVariablePayload(values);
    const certificateName = manualValues.certificateName || manualValues.certificateNameEn || selectedTemplate.definition?.name || selectedTemplate.name;
    const certificateNameEn = manualValues.certificateNameEn || selectedTemplate.definition?.nameEn || selectedTemplate.nameEn || certificateName;
    const categoryName = manualValues.categoryName || selectedTemplate.categoryName || "";
    const categoryNameEn = manualValues.categoryNameEn || selectedTemplate.categoryNameEn || categoryName;
    const holderName = manualValues.holderName || (locale === "zh" ? "证书持有人" : "Credential Holder");

    return {
      locale,
      name: certificateName,
      nameEn: certificateNameEn,
      categoryName,
      categoryNameEn,
      holderName,
      holderNameEn: manualValues.holderNameEn || holderName,
      issueDate: currentIssueDate,
      completionDate: manualValues.completionDate || currentIssueDate,
      certificateNumber: editingIssueId && editingCertificateNumber ? editingCertificateNumber : "CV-PREVIEW",
      variableValues: manualValues,
      renderConfig: selectedTemplate.renderConfig ?? null,
    };
  }

  async function issueCertificate() {
    if (!email || !templateId || !holderName.trim()) {
      openIssueFeedback("error", t(locale, "请填写收件人邮箱、证书持有人并选择模板。", "Enter a recipient email, certificate holder, and select a template."));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/admin/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          templateId,
          issueDate,
          ...(editingIssueId ? { editIssueId: editingIssueId } : {}),
          variableValues: normalizeManualVariablePayload(singleVariableValues),
        }),
      });
      let result: { error?: string; verificationCode?: string } = {};
      const responseType = response.headers.get("content-type") ?? "";

      if (responseType.includes("application/json")) {
        result = (await response.json()) as { error?: string; verificationCode?: string };
      } else if (!response.ok) {
        const rawError = await response.text();
        if (rawError.trim()) {
          result.error = rawError;
        }
      }

      if (response.ok) {
        const successMessage = `${editingIssueId ? t(locale, "已重新签发", "Re-issued") : t(locale, "已签发", "Issued")}: ${result.verificationCode ?? ""}`;
        resetSingleIssueForm();
        openIssueFeedback("success", successMessage);
        router.refresh();
      } else {
        openIssueFeedback("error", result.error ?? t(locale, "签发失败", "Issue failed"));
      }
    } catch {
      openIssueFeedback("error", t(locale, "网络错误", "Network error"));
    } finally {
      setLoading(false);
    }
  }

  function isBatchTerminal(status: string) {
    return ["COMPLETED", "COMPLETED_WITH_FAILURES", "FAILED"].includes(status);
  }

  async function loadBatchActivities() {
    if (batchActivityOptions.length > 0 || batchActivityLoading) {
      return;
    }
    setBatchActivityLoading(true);
    try {
      const response = await fetch("/api/activities?limit=100", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const result = (await response.json()) as {
        activities?: Array<{ id: string; title: string; titleEn?: string | null; status: string; _count?: { participations?: number } }>;
      };
      setBatchActivityOptions((result.activities ?? []).map((activity) => ({
        id: activity.id,
        title: activity.title,
        titleEn: activity.titleEn ?? null,
        status: activity.status,
        participations: activity._count?.participations ?? 0,
      })));
    } catch {
      // Keep the activity selector empty; the admin can retry by switching sources.
    } finally {
      setBatchActivityLoading(false);
    }
  }

  useEffect(() => {
    if (mode === "batch" && batchSource === "ACTIVITY_ELIGIBLE_LIST") {
      void loadBatchActivities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, batchSource]);

  async function runBatchPreflight() {
    setBatchMessage("");
    setBatchPreflightReport(null);

    if (!templateId) {
      setBatchMessage(t(locale, "请选择证书模板。", "Select a certificate template first."));
      return;
    }
    if (batchSource === "MANUAL_LIST" && parseManualIssueEmails(batchEmails).length === 0) {
      setBatchMessage(t(locale, "请填写至少一个收件人邮箱。", "Enter at least one recipient email."));
      return;
    }
    if (batchSource === "ACTIVITY_ELIGIBLE_LIST" && !batchActivityId) {
      setBatchMessage(t(locale, "请选择活动。", "Select an activity."));
      return;
    }

    setBatchPreflightLoading(true);
    try {
      const response = await fetch("/api/admin/certificates/batches/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          source: batchSource,
          ...(batchSource === "MANUAL_LIST" ? { recipients: batchEmails } : {}),
          ...(batchSource === "ACTIVITY_ELIGIBLE_LIST" ? { activityId: batchActivityId } : {}),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; report?: CertificateBatchPreflightReport };
      if (!response.ok) {
        setBatchMessage(result.error ?? t(locale, "预检失败。", "Preflight failed."));
        return;
      }
      setBatchPreflightReport(result.report ?? null);
    } catch {
      setBatchMessage(t(locale, "网络错误。", "Network error."));
    } finally {
      setBatchPreflightLoading(false);
    }
  }

  async function refreshBatchList() {
    try {
      const response = await fetch("/api/admin/certificates/batches?limit=8", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const result = (await response.json()) as { batches?: CertificateAdminBatch[] };
      setBatchList(result.batches ?? []);
    } catch {
      // Keep the existing list on transient failures.
    }
  }

  async function pollBatchProcess(targetBatchId: string) {
    try {
      const response = await fetch(`/api/admin/certificates/batches/${encodeURIComponent(targetBatchId)}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        batch?: CertificateAdminBatch;
        items?: CertificateAdminBatchItem[];
      };
      if (!response.ok || !result.batch) {
        setBatchProcessing(false);
        setBatchMessage(result.error ?? t(locale, "批次处理失败。", "Batch processing failed."));
        return;
      }
      setActiveBatch(result.batch);
      setBatchDetailItems(result.items ?? []);
      setBatchList((previous) => previous.map((entry) => (entry.id === result.batch!.id ? { ...entry, ...result.batch! } : entry)));
      if (isBatchTerminal(result.batch.status)) {
        setBatchProcessing(false);
        await refreshBatchList();
        router.refresh();
      }
    } catch {
      setBatchProcessing(false);
      setBatchMessage(t(locale, "网络错误。", "Network error."));
    }
  }

  useEffect(() => {
    if (!activeBatch || !batchProcessing || isBatchTerminal(activeBatch.status)) {
      return;
    }

    batchPollTimer.current = window.setTimeout(() => {
      void pollBatchProcess(activeBatch.id);
    }, 1500);

    return () => {
      if (batchPollTimer.current !== null) {
        window.clearTimeout(batchPollTimer.current);
        batchPollTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBatch?.id, activeBatch?.status, batchProcessing]);

  async function createBatch() {
    setBatchMessage("");

    if (!templateId) {
      setBatchMessage(t(locale, "请选择证书模板。", "Select a certificate template first."));
      return;
    }
    if (batchSource === "MANUAL_LIST" && parseManualIssueEmails(batchEmails).length === 0) {
      setBatchMessage(t(locale, "请填写至少一个收件人邮箱。", "Enter at least one recipient email."));
      return;
    }
    if (batchSource === "ACTIVITY_ELIGIBLE_LIST" && !batchActivityId) {
      setBatchMessage(t(locale, "请选择活动。", "Select an activity."));
      return;
    }

    setBatchLoading(true);
    try {
      const response = await fetch("/api/admin/certificates/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: batchIdempotencyKey,
          templateId,
          source: batchSource,
          issueDate: batchIssueDate,
          notify: batchNotify,
          variableValues: normalizeManualVariablePayload(batchVariableValues),
          ...(batchSource === "MANUAL_LIST" ? { recipients: batchEmails } : {}),
          ...(batchSource === "ACTIVITY_ELIGIBLE_LIST" ? { activityId: batchActivityId } : {}),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        replayed?: boolean;
        batch?: CertificateAdminBatch;
        items?: CertificateAdminBatchItem[];
      };
      if (!response.ok || !result.batch) {
        setBatchMessage(result.error ?? t(locale, "创建批次失败。", "Failed to create the batch."));
        return;
      }

      setActiveBatch(result.batch);
      setBatchDetailItems(result.items ?? []);
      setBatchProcessing(true);
      setBatchPreflightReport(null);
      if (!result.replayed) {
        setBatchIdempotencyKey(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `batch-${Date.now()}`);
      }
      await refreshBatchList();
    } catch {
      setBatchMessage(t(locale, "网络错误。", "Network error."));
    } finally {
      setBatchLoading(false);
    }
  }

  async function retryFailedBatch() {
    if (!activeBatch) {
      return;
    }
    setBatchProcessing(true);
    setBatchMessage("");
    try {
      const response = await fetch(`/api/admin/certificates/batches/${encodeURIComponent(activeBatch.id)}/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        batch?: CertificateAdminBatch;
        items?: CertificateAdminBatchItem[];
      };
      if (!response.ok || !result.batch) {
        setBatchProcessing(false);
        setBatchMessage(result.error ?? t(locale, "重试失败。", "Retry failed."));
        return;
      }
      setActiveBatch(result.batch);
      setBatchDetailItems(result.items ?? []);
      if (isBatchTerminal(result.batch.status)) {
        setBatchProcessing(false);
        await refreshBatchList();
      }
    } catch {
      setBatchProcessing(false);
      setBatchMessage(t(locale, "网络错误。", "Network error."));
    }
  }

  async function viewBatch(batch: CertificateAdminBatch) {
    setBatchMessage("");
    try {
      const response = await fetch(`/api/admin/certificates/batches/${encodeURIComponent(batch.id)}`, { cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        batch?: CertificateAdminBatch;
        items?: CertificateAdminBatchItem[];
      };
      if (!response.ok || !result.batch) {
        setBatchMessage(result.error ?? t(locale, "加载批次失败。", "Failed to load the batch."));
        return;
      }
      setActiveBatch(result.batch);
      setBatchDetailItems(result.items ?? []);
      setBatchProcessing(!isBatchTerminal(result.batch.status));
    } catch {
      setBatchMessage(t(locale, "网络错误。", "Network error."));
    }
  }

  async function previewCertificate() {
    setMessage("");
    if (!selectedTemplate) {
      setMessage(t(locale, "请先选择证书模板。", "Please select a certificate template first."));
      return;
    }

    const previewPayload = buildPreviewPayload(singleVariableValues, issueDate);
    if (!previewPayload) {
      setMessage(t(locale, "预览生成失败。", "Failed to generate preview."));
      return;
    }

    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewHtml("");
    setPreviewDialogTitle(selectedTemplate ? localName(locale, selectedTemplate) : t(locale, "证书预览", "Certificate preview"));
    setPreviewDialogSubtitle(selectedTemplate ? getTemplateLayoutLabel(locale, selectedTemplate) : "");

    try {
      const response = await fetch("/api/admin/certificates/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewPayload),
      });

      let result: { error?: string; html?: string } = {};
      const responseType = response.headers.get("content-type") ?? "";
      if (responseType.includes("application/json")) {
        result = (await response.json()) as { error?: string; html?: string };
      } else if (!response.ok) {
        const rawError = await response.text();
        if (rawError.trim()) {
          result.error = rawError;
        }
      }

      if (!response.ok) {
        setPreviewError(result.error ?? t(locale, "预览生成失败。", "Failed to generate preview."));
        return;
      }

      setPreviewHtml(result.html ?? "");
    } catch {
      setPreviewError(t(locale, "网络错误。", "Network error."));
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreviewModal() {
    setPreviewOpen(false);
    setPreviewLoading(false);
    setPreviewError("");
    setPreviewHtml("");
    setPreviewDialogTitle("");
    setPreviewDialogSubtitle("");
  }

  async function downloadIssuedCertificate(issue: CertificateAdminIssue) {
    setMessage("");
    setRecordActionLoadingId(issue.id);
    try {
      window.open(`/api/certificates/${encodeURIComponent(issue.id)}/artifact?disposition=attachment`, "_blank", "noopener,noreferrer");
      router.refresh();
    } catch {
      setMessage(t(locale, "网络错误。", "Network error."));
    } finally {
      setRecordActionLoadingId(null);
    }
  }

  async function revokeIssuedCertificate(issue: CertificateAdminIssue) {
    setMessage("");
    const reason = window.prompt(t(locale, "请输入撤销原因（至少 3 个字符）：", "Enter a revocation reason (at least 3 characters):"))?.trim();
    if (!reason) {
      setMessage(t(locale, "撤销原因不能为空。", "A revocation reason is required."));
      return;
    }
    setRecordActionLoadingId(issue.id);
    try {
      const response = await fetch(`/api/admin/certificates/${encodeURIComponent(issue.id)}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(result.error ?? t(locale, "撤回失败。", "Revoke failed."));
        return;
      }

      setMessage(t(locale, "证书已撤回。", "Certificate revoked."));
      router.refresh();
    } catch {
      setMessage(t(locale, "网络错误。", "Network error."));
    } finally {
      setRecordActionLoadingId(null);
    }
  }

  function editIssuedCertificate(issue: CertificateAdminIssue) {
    const template = activeTemplates.find((item) => item.id === issue.templateId) ?? null;
    const defaults = buildInitialManualVariableValues(template);
    const issueValues = normalizeIssuedVariableValues(issue.issueVariableValues);

    setMode("single");
    setEditingIssueId(issue.id);
    setEditingCertificateNumber(issue.certificateNumber ?? "");
    setTemplateId(issue.templateId ?? "");
    setEmail(issue.holderEmail ?? "");
    setHolderName(issue.holderName ?? issueValues.holderName ?? "");
    setAutoFilledHolderName("");
    setIssueDate(formatTodayIsoDate());
    setSingleVariableValues({
      ...defaults,
      ...issueValues,
      holderName: issue.holderName,
      certificateName: issue.certificateName,
      categoryName: issue.categoryName,
    });
    setMessage(t(locale, "已回填该证书到上方，可修改后再次签发。", "Loaded this certificate into the form above. You can edit and re-issue."));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreviewModal();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [previewOpen]);

  useEffect(() => {
    if (!issueFeedbackOpen) {
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeIssueFeedbackModal();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [issueFeedbackOpen]);

  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead title={t(locale, "证书签发", "Issue Certificates")} description={t(locale, "向单个用户或批量名单签发可验证数字证书。", "Single or batch issue credentials to users.")} />
      <div className="cpca-tab-row"><button className="cpca-btn" onClick={() => setMode("single")} type="button">{t(locale, "单个签发", "Single Issue")}</button><button className="cpca-btn" onClick={() => setMode("batch")} type="button">{t(locale, "批量签发", "Batch Issue")}</button></div>
      {mode === "single" ? (
        <Card>
          <div className="cpca-form-grid">
            <label><span>{t(locale, "证书模板", "Certificate Template")}</span><select value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">{t(locale, "选择模板", "Select template...")}</option>{activeTemplates.map((template) => <option key={template.id} value={template.id}>{localName(locale, template)}</option>)}</select></label>
            <label><span>{t(locale, "分类", "Category")}</span><input readOnly value={selectedTemplate ? (localName(locale, { name: selectedTemplate.categoryName ?? "", nameEn: selectedTemplate.categoryNameEn ?? null })) : t(locale, "从模板自动匹配", "Auto-filled from template")} /></label>
            <label><span>{t(locale, "收件人邮箱", "Recipient email")}</span><input onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" value={email} /></label>
            <label><span>{t(locale, "证书持有人", "Certificate holder")}</span><input onChange={(event) => { const nextHolderName = event.target.value; setHolderName(nextHolderName); setSingleVariableValues((previous) => ({ ...previous, holderName: nextHolderName })); if (nextHolderName !== autoFilledHolderName) { setAutoFilledHolderName(""); } }} placeholder={t(locale, "请输入证书持有人姓名", "Enter certificate holder name")} required type="text" value={holderName} /></label>
            <label><span>{t(locale, "证书编号", "Certificate Number")}</span><input readOnly value={editingIssueId && editingCertificateNumber ? editingCertificateNumber : "CV-{AUTO-GENERATED}"} /></label>
            <label><span>{t(locale, "签发日期", "Issue Date")}</span><input onChange={(event) => setIssueDate(event.target.value)} type="date" value={issueDate} /></label>
          </div>
          {recipientLookupLoading ? <FormHelpText>{t(locale, "正在匹配 Climate Passport 持有人信息...", "Looking up Climate Passport holder info...")}</FormHelpText> : null}
          {renderVariableInputs(singleVariableValues, setSingleVariableValues)}
          {message ? <FormMessageText>{message}</FormMessageText> : null}
          <div className="cpca-actions"><button className="cpca-btn cpca-btn-outline" disabled={previewLoading} onClick={() => void previewCertificate()} type="button">{previewLoading ? t(locale, "预览生成中...", "Rendering preview...") : t(locale, "预览证书", "Preview Certificate")}</button><button className="cpca-btn cpca-btn-amber" disabled={loading} onClick={issueCertificate} type="button">{loading ? (editingIssueId ? t(locale, "重新签发中...", "Re-issuing...") : t(locale, "签发中...", "Issuing...")) : (editingIssueId ? t(locale, "确认修改并重新签发", "Confirm Edit & Re-issue") : t(locale, "确认签发", "Confirm & Issue"))}</button>{editingIssueId ? <button className="cpca-btn cpca-btn-ghost" onClick={() => resetSingleIssueForm()} type="button">{t(locale, "取消编辑", "Cancel Edit")}</button> : null}</div>
          {previewOpen ? (
            <div className="cpca-preview-modal" onClick={closePreviewModal} role="presentation">
              <div className="cpca-preview-modal-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={t(locale, "证书预览", "Certificate preview")}>
                <div className="cpca-preview-modal-head">
                  <div>
                    <strong>{previewDialogTitle || (selectedTemplate ? localName(locale, selectedTemplate) : t(locale, "证书预览", "Certificate preview"))}</strong>
                    <small>{previewDialogSubtitle || (selectedTemplate ? getTemplateLayoutLabel(locale, selectedTemplate) : "")}</small>
                  </div>
                  <button className="cpca-btn cpca-btn-ghost" onClick={closePreviewModal} type="button">
                    {t(locale, "关闭", "Close")}
                  </button>
                </div>
                <div className="cpca-preview-modal-body">
                  {previewLoading ? <FormHelpText>{t(locale, "预览生成中...", "Rendering preview...")}</FormHelpText> : null}
                  {previewError ? <FormErrorText>{previewError}</FormErrorText> : null}
                  {!previewLoading && !previewError && previewHtml ? (
                    <iframe className="cpca-preview-modal-frame" sandbox="allow-scripts allow-modals" srcDoc={previewHtml} title={t(locale, "证书预览", "Certificate preview")} />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {issueFeedbackOpen ? (
            <div className="cpca-preview-modal" onClick={closeIssueFeedbackModal} role="presentation">
              <div className="cpca-feedback-modal-dialog" onClick={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={issueFeedbackKind === "success" ? t(locale, "签发成功", "Issue succeeded") : t(locale, "签发失败", "Issue failed")}>
                <div className="cpca-preview-modal-head">
                  <div>
                    <strong>{issueFeedbackKind === "success" ? t(locale, "签发成功", "Issue succeeded") : t(locale, "签发失败", "Issue failed")}</strong>
                  </div>
                  <button className="cpca-btn cpca-btn-ghost" onClick={closeIssueFeedbackModal} type="button">
                    {t(locale, "关闭", "Close")}
                  </button>
                </div>
                <div className="cpca-feedback-modal-body">
                  {issueFeedbackKind === "success" ? <FormSuccessText>{issueFeedbackMessage}</FormSuccessText> : <FormErrorText>{issueFeedbackMessage}</FormErrorText>}
                  <div className="cpca-actions">
                    <button className="cpca-btn cpca-btn-amber" onClick={closeIssueFeedbackModal} type="button">
                      {t(locale, "我知道了", "OK")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card>
          <div className="cpca-form-grid">
            <label><span>{t(locale, "证书模板", "Certificate Template")}</span><select onChange={(event) => { setTemplateId(event.target.value); setBatchPreflightReport(null); }} value={templateId}><option value="">{t(locale, "选择模板", "Select template...")}</option>{activeTemplates.map((template) => <option key={template.id} value={template.id}>{localName(locale, template)}</option>)}</select></label>
            <label><span>{t(locale, "分类", "Category")}</span><input readOnly value={selectedTemplate ? (localName(locale, { name: selectedTemplate.categoryName ?? "", nameEn: selectedTemplate.categoryNameEn ?? null })) : t(locale, "从模板自动匹配", "Auto-filled from template")} /></label>
            <label><span>{t(locale, "签发日期", "Issue Date")}</span><input onChange={(event) => setBatchIssueDate(event.target.value)} type="date" value={batchIssueDate} /></label>
            <label><span>{t(locale, "名单来源", "Recipient Source")}</span><select onChange={(event) => { const nextSource = event.target.value as "MANUAL_LIST" | "ACTIVITY_ELIGIBLE_LIST"; setBatchSource(nextSource); setBatchPreflightReport(null); }} value={batchSource}><option value="MANUAL_LIST">{t(locale, "手动/CSV 邮箱列表", "Manual/CSV email list")}</option><option value="ACTIVITY_ELIGIBLE_LIST">{t(locale, "活动合格名单", "Activity eligible list")}</option></select></label>
            {batchSource === "ACTIVITY_ELIGIBLE_LIST" ? (
              <label className="wide"><span>{t(locale, "选择活动", "Select activity")}</span><select onChange={(event) => { setBatchActivityId(event.target.value); setBatchPreflightReport(null); }} value={batchActivityId}><option value="">{batchActivityLoading ? t(locale, "加载活动中...", "Loading activities...") : t(locale, "选择活动", "Select activity...")}</option>{batchActivityOptions.map((activity) => <option key={activity.id} value={activity.id}>{localName(locale, { name: activity.title, nameEn: activity.titleEn })}（{activity.participations} {t(locale, "参与", "participants")}）</option>)}</select></label>
            ) : (
              <label className="wide"><span>{t(locale, "收件人邮箱（每行一个，或用逗号分隔）", "Recipient emails (one per line or comma-separated)")}</span><textarea onChange={(event) => { setBatchEmails(event.target.value); setBatchPreflightReport(null); }} rows={6} value={batchEmails} /></label>
            )}
            <label><span>{t(locale, "站内通知", "In-app notification")}</span><select onChange={(event) => setBatchNotify(event.target.value === "on")} value={batchNotify ? "on" : "off"}><option value="on">{t(locale, "每人签发后发送", "Notify each recipient")}</option><option value="off">{t(locale, "不发送", "Do not notify")}</option></select></label>
          </div>
          {renderVariableInputs(batchVariableValues, setBatchVariableValues)}
          {batchMessage ? <FormMessageText>{batchMessage}</FormMessageText> : null}
          {batchPreflightReport?.summary ? (
            <FormHelpText>
              {t(locale, "预检结果", "Preflight")}: {t(locale, "总计", "total")} {batchPreflightReport.summary.total} · {t(locale, "有效", "valid")} {batchPreflightReport.summary.valid}
              {batchPreflightReport.summary.malformed ? ` · ${t(locale, "格式错误", "malformed")} ${batchPreflightReport.summary.malformed}` : ""}
              {batchPreflightReport.summary.duplicates ? ` · ${t(locale, "重复", "duplicates")} ${batchPreflightReport.summary.duplicates}` : ""}
              {batchPreflightReport.summary.existingIssues ? ` · ${t(locale, "已签发", "already issued")} ${batchPreflightReport.summary.existingIssues}` : ""}
              {batchPreflightReport.activity ? ` · ${batchPreflightReport.activity.title}: ${batchPreflightReport.activity.eligibleCount - batchPreflightReport.activity.alreadyIssuedCount}/${batchPreflightReport.activity.eligibleCount}` : ""}
            </FormHelpText>
          ) : null}
          {batchPreflightReport?.rows?.some((row) => row.state === "malformed" || row.state === "duplicate") ? (
            <div className="cpca-table-wrap">
              <table className="cpca-table">
                <thead>
                  <tr>
                    <th>{t(locale, "行", "Row")}</th>
                    <th>{t(locale, "内容", "Content")}</th>
                    <th>{t(locale, "问题", "Issue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {batchPreflightReport.rows.filter((row) => row.state === "malformed" || row.state === "duplicate").slice(0, 10).map((row) => (
                    <tr key={row.row}>
                      <td className="cpca-mono">{row.row}</td>
                      <td>{row.raw}</td>
                      <td>{row.state === "malformed" ? t(locale, "邮箱格式错误", "Malformed email") : t(locale, "列表内重复", "Duplicate in list")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="cpca-actions">
            <button className="cpca-btn cpca-btn-outline" disabled={batchPreflightLoading} onClick={runBatchPreflight} type="button">{batchPreflightLoading ? t(locale, "预检中...", "Checking...") : t(locale, "预检名单", "Preflight List")}</button>
            <button className="cpca-btn cpca-btn-amber" disabled={batchLoading || batchProcessing} onClick={createBatch} type="button">{batchLoading ? t(locale, "创建批次中...", "Creating batch...") : batchProcessing ? t(locale, "批次处理中...", "Processing batch...") : t(locale, "创建并处理批次", "Create & Process Batch")}</button>
          </div>
          {activeBatch ? (
            <div className="cpca-batch-panel">
              <FormHelpText>
                {t(locale, "批次", "Batch")} {activeBatch.id.slice(0, 8)} · {batchStatusLabel(locale, activeBatch.status)} · {t(locale, "成功", "succeeded")} {activeBatch.succeededCount}/{activeBatch.totalCount}{activeBatch.failedCount ? ` · ${t(locale, "失败", "failed")} ${activeBatch.failedCount}` : ""}
              </FormHelpText>
              {batchDetailItems.length ? (
                <div className="cpca-table-wrap">
                  <table className="cpca-table">
                    <thead>
                      <tr>
                        <th>{t(locale, "邮箱", "Email")}</th>
                        <th>{t(locale, "状态", "Status")}</th>
                        <th>{t(locale, "证书编号", "Certificate Number")}</th>
                        <th>{t(locale, "次数", "Attempts")}</th>
                        <th>{t(locale, "错误", "Error")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchDetailItems.slice(0, 20).map((item) => (
                        <tr key={item.id}>
                          <td>{item.email}</td>
                          <td><StatusBadge status={item.status}>{batchItemStatusLabel(locale, item.status)}</StatusBadge></td>
                          <td className="cpca-mono">{item.certificateIssue?.verificationCode ?? "—"}</td>
                          <td className="cpca-mono">{item.attempts}</td>
                          <td>{item.error ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {activeBatch.failedCount > 0 && !batchProcessing ? (
                <div className="cpca-actions"><button className="cpca-btn cpca-btn-outline" onClick={retryFailedBatch} type="button">{t(locale, "重试失败项", "Retry Failed Items")}</button></div>
              ) : null}
            </div>
          ) : null}
        </Card>
      )}
      {batchList.length ? (
        <Card title={t(locale, "最近批次", "Recent Batches")}>
          <div className="cpca-table-wrap">
            <table className="cpca-table">
              <thead>
                <tr>
                  <th>{t(locale, "创建时间", "Created")}</th>
                  <th>{t(locale, "来源", "Source")}</th>
                  <th>{t(locale, "证书", "Certificate")}</th>
                  <th>{t(locale, "进度", "Progress")}</th>
                  <th>{t(locale, "状态", "Status")}</th>
                  <th>{t(locale, "操作", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {batchList.slice(0, 8).map((batch) => (
                  <tr key={batch.id}>
                    <td>{new Date(batch.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</td>
                    <td>{batchSourceLabel(locale, batch.source, batch.activity)}</td>
                    <td>{batch.definition ? localName(locale, { name: batch.definition.name, nameEn: batch.definition.nameEn }) : "—"}</td>
                    <td className="cpca-mono">{batch.succeededCount + batch.failedCount}/{batch.totalCount}{batch.failedCount ? ` (${t(locale, "失败", "failed")} ${batch.failedCount})` : ""}</td>
                    <td><StatusBadge status={batch.status}>{batchStatusLabel(locale, batch.status)}</StatusBadge></td>
                    <td><button className="cpca-btn cpca-btn-ghost" onClick={() => void viewBatch(batch)} type="button">{t(locale, "查看", "View")}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      <Card title={t(locale, "最近签发记录", "Recent Issuances")}>
        <div className="cpca-table-wrap">
          <table className="cpca-table">
            <thead>
              <tr>
                <th>{t(locale, "证书编号", "Certificate Number")}</th>
                <th>{t(locale, "持有人", "Holder")}</th>
                <th>{t(locale, "证书", "Certificate")}</th>
                <th>{t(locale, "签发日期", "Issue Date")}</th>
                <th>{t(locale, "状态", "Status")}</th>
                <th>{t(locale, "操作", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {recentIssues.slice(0, 5).map((issue) => (
                <tr key={issue.id}>
                  <td className="cpca-mono">{issue.certificateNumber}</td>
                  <td className="cpca-strong">{issue.holderName}</td>
                  <td>{issue.certificateName}</td>
                  <td>{issue.issueDate}</td>
                  <td><StatusBadge status={issue.status}>{issue.status}</StatusBadge></td>
                  <td>
                    <div className="cpca-actions compact">
                      <button
                        className="cpca-btn cpca-btn-ghost"
                        disabled={issue.status === "REVOKED"}
                        onClick={() => editIssuedCertificate(issue)}
                        type="button"
                      >
                        {t(locale, "编辑", "Edit")}
                      </button>
                      <button
                        className="cpca-btn cpca-btn-ghost"
                        disabled={recordActionLoadingId === issue.id}
                        onClick={() => void downloadIssuedCertificate(issue)}
                        type="button"
                      >
                        {t(locale, "预览/打印", "Preview/Print")}
                      </button>
                      <button
                        className="cpca-btn cpca-btn-danger"
                        disabled={recordActionLoadingId === issue.id || issue.status === "REVOKED"}
                        onClick={() => void revokeIssuedCertificate(issue)}
                        type="button"
                      >
                        {t(locale, "撤回", "Revoke")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </CertificateAdminFrame>
  );
}

export function CertificateAdminApplications({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [rows, setRows] = useState<Array<any>>([]);
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/admin/certificate-applications?limit=100").then(async (response) => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? "Request failed."); setRows(data.applications ?? []); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Request failed.")); }, []);
  async function review(id: string, action: "REQUEST_INFORMATION" | "APPROVE_AND_ISSUE" | "REJECT") { const message = action === "APPROVE_AND_ISSUE" ? undefined : window.prompt(action === "REJECT" ? t(locale, "请输入拒绝原因：", "Enter rejection reason:") : t(locale, "请输入需要补充的信息：", "Enter requested information:"))?.trim(); if (action !== "APPROVE_AND_ISSUE" && !message) return; setLoadingId(id); setError(""); try { const response = await fetch(`/api/admin/certificate-applications/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, message }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? "Review failed."); setRows((current) => current.map((item) => item.id === id ? { ...item, ...(data.application ?? {}), status: data.application?.status ?? (action === "APPROVE_AND_ISSUE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "NEEDS_INFORMATION") } : item)); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Review failed."); } finally { setLoadingId(null); } }
  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead title={t(locale, "证书申请审核", "Certificate Applications")} description={t(locale, "审核用户主动提交的证书、志愿服务、项目完成和活动参与证明申请。", "Review user-initiated certificate requests.")} />
      {error ? <FormErrorText>{error}</FormErrorText> : null}
      <Card><div className="cpca-table-wrap"><table className="cpca-table"><thead><tr><th>{t(locale, "申请人", "Applicant")}</th><th>{t(locale, "证书类型", "Certificate Type")}</th><th>{t(locale, "项目 / 活动", "Program / Event")}</th><th>{t(locale, "提交时间", "Submitted")}</th><th>{t(locale, "状态", "Status")}</th><th>{t(locale, "操作", "Actions")}</th></tr></thead><tbody>{rows.map((application) => <tr key={application.id}><td><span className="cpca-strong">{application.applicant?.name}</span><small>{application.applicant?.email}</small></td><td>{localName(locale, application.definition)}</td><td>{application.sourceLabel ?? "—"}</td><td>{application.submittedAt ? new Date(application.submittedAt).toLocaleDateString() : "—"}</td><td><StatusBadge status={application.status}>{application.status}</StatusBadge></td><td>{application.status === "SUBMITTED" ? <div className="cpca-actions compact"><button className="cpca-btn cpca-btn-success" disabled={loadingId === application.id} onClick={() => void review(application.id, "APPROVE_AND_ISSUE")} type="button">{t(locale, "通过并签发", "Approve & issue")}</button><button className="cpca-btn" disabled={loadingId === application.id} onClick={() => void review(application.id, "REQUEST_INFORMATION")} type="button">{t(locale, "补充信息", "Request info")}</button><button className="cpca-btn cpca-btn-danger" disabled={loadingId === application.id} onClick={() => void review(application.id, "REJECT")} type="button">{t(locale, "拒绝", "Reject")}</button></div> : "—"}</td></tr>)}{rows.length === 0 ? <tr><td className="cpca-muted" colSpan={6}>{t(locale, "暂无证书申请。", "No certificate applications.")}</td></tr> : null}</tbody></table></div></Card>
    </CertificateAdminFrame>
  );
}

export function CertificateAdminRules({ locale, initialRules, activities, definitions }: {
  locale: Locale;
  initialRules: CertificateIssuingRuleRow[];
  activities: Array<{ id: string; title: string; titleEn?: string | null }>;
  definitions: Array<{ id: string; name: string; nameEn?: string | null }>;
}) {
  const [rules, setRules] = useState(initialRules);
  const [name, setName] = useState("");
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");
  const [definitionId, setDefinitionId] = useState(definitions[0]?.id ?? "");
  const [isActive, setIsActive] = useState(false);
  const [notifyUser, setNotifyUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createRule() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/certificates/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, activityId, certificateDefinitionId: definitionId, trigger: "ACTIVITY_CHECKIN", isActive, notifyUser, requiresAdminConfirmation: false, conditionJson: null }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; rule?: CertificateIssuingRuleRow };
      if (!response.ok || !result.rule) throw new Error(result.error ?? t(locale, "创建规则失败。", "Failed to create rule."));
      setRules((current) => [result.rule!, ...current]);
      setName(""); setIsActive(false);
      setMessage(t(locale, "规则已保存。", "Rule saved."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(locale, "创建规则失败。", "Failed to create rule."));
    } finally { setLoading(false); }
  }

  async function updateRule(rule: CertificateIssuingRuleRow, values: { name?: string; isActive?: boolean; notifyUser?: boolean }) {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/certificates/rules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, ...values }) });
      const result = await response.json().catch(() => ({})) as { error?: string; rule?: CertificateIssuingRuleRow };
      if (!response.ok || !result.rule) throw new Error(result.error ?? t(locale, "更新规则失败。", "Failed to update rule."));
      setRules((current) => current.map((item) => item.id === rule.id ? result.rule! : item));
      setMessage(t(locale, "规则已更新。", "Rule updated."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(locale, "更新规则失败。", "Failed to update rule."));
    } finally { setLoading(false); }
  }

  function renameRule(rule: CertificateIssuingRuleRow) {
    const nextName = window.prompt(t(locale, "规则名称", "Rule name"), rule.name)?.trim();
    if (nextName && nextName !== rule.name) void updateRule(rule, { name: nextName });
  }

  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead title={t(locale, "自动签发规则", "Automatic Issuing Rules")} description={t(locale, "当前仅支持活动签到成功后立即签发；其他触发来源尚未开放。", "Only immediate issuance after a successful Activity check-in is currently supported.")} />
      {message ? <FormSuccessText>{message}</FormSuccessText> : null}{error ? <FormErrorText>{error}</FormErrorText> : null}
      <Card><div className="cpca-table-wrap"><table className="cpca-table"><thead><tr><th>{t(locale, "规则名称", "Rule Name")}</th><th>{t(locale, "活动", "Activity")}</th><th>{t(locale, "触发", "Trigger")}</th><th>{t(locale, "证书", "Certificate")}</th><th>{t(locale, "通知", "Notify")}</th><th>{t(locale, "签发数", "Issued")}</th><th>{t(locale, "状态", "Status")}</th><th>{t(locale, "操作", "Actions")}</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id}><td className="cpca-strong">{rule.name}</td><td>{locale === "zh" ? rule.activity.title : rule.activity.titleEn ?? rule.activity.title}</td><td>{t(locale, "活动签到成功", "Activity check-in")}</td><td>{localName(locale, rule.certificateDefinition)}</td><td><input aria-label={t(locale, "通知用户", "Notify user")} checked={rule.notifyUser} disabled={loading} onChange={(event) => void updateRule(rule, { notifyUser: event.target.checked })} type="checkbox" /></td><td>{rule._count?.issuances ?? 0}</td><td><StatusBadge status={rule.effective ? "ACTIVE" : rule.isActive ? "BLOCKED" : "INACTIVE"}>{rule.effective ? t(locale, "已启用", "Active") : rule.isActive ? t(locale, "配置无效", "Blocked") : t(locale, "未启用", "Inactive")}</StatusBadge></td><td><div className="cpca-actions compact"><button className="cpca-btn cpca-btn-ghost" disabled={loading} onClick={() => renameRule(rule)} type="button">{t(locale, "重命名", "Rename")}</button><button className="cpca-btn cpca-btn-outline" disabled={loading || (!rule.eligible && !rule.isActive)} onClick={() => void updateRule(rule, { isActive: !rule.isActive })} type="button">{rule.isActive ? t(locale, "停用", "Disable") : t(locale, "启用", "Enable")}</button></div></td></tr>)}{rules.length === 0 ? <tr><td className="cpca-muted" colSpan={8}>{t(locale, "暂无持久化规则。", "No persisted rules.")}</td></tr> : null}</tbody></table></div></Card>
      <Card title={t(locale, "创建签发规则", "Create Issuing Rule")}><div className="cpca-form-grid"><label><span>{t(locale, "规则名称", "Rule Name")}</span><input onChange={(event) => setName(event.target.value)} placeholder={t(locale, "活动签到证书", "Activity check-in certificate")} value={name} /></label><label><span>{t(locale, "触发来源", "Trigger Source")}</span><select value="ACTIVITY_CHECKIN"><option value="ACTIVITY_CHECKIN">{t(locale, "活动签到", "Activity check-in")}</option><option disabled>{t(locale, "课程完成（暂不可用）", "Course completion (unavailable)")}</option><option disabled>{t(locale, "Learning Experience 完成（暂不可用）", "Learning Experience completion (unavailable)")}</option><option disabled>{t(locale, "积分门槛（暂不可用）", "Points threshold (unavailable)")}</option></select></label><label><span>{t(locale, "活动", "Activity")}</span><select onChange={(event) => setActivityId(event.target.value)} value={activityId}>{activities.map((activity) => <option key={activity.id} value={activity.id}>{locale === "zh" ? activity.title : activity.titleEn ?? activity.title}</option>)}</select></label><label><span>{t(locale, "触发条件", "Trigger Condition")}</span><input readOnly value={t(locale, "签到成功（固定）", "Successful check-in (fixed)")} /></label><label><span>{t(locale, "证书", "Certificate")}</span><select onChange={(event) => setDefinitionId(event.target.value)} value={definitionId}>{definitions.map((definition) => <option key={definition.id} value={definition.id}>{localName(locale, definition)}</option>)}</select></label><label><span>{t(locale, "签发时间", "Issue Timing")}</span><input readOnly value={t(locale, "立即", "Immediate")} /></label></div><div className="cpca-toggle-row"><label><input checked={notifyUser} onChange={(event) => setNotifyUser(event.target.checked)} type="checkbox" /> {t(locale, "站内通知用户", "Notify user in app")}</label><label><input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" /> {t(locale, "保存后立即启用", "Enable after saving")}</label></div><div className="cpca-actions"><button className="cpca-btn cpca-btn-amber" disabled={loading || name.trim().length < 3 || !activityId || !definitionId} onClick={() => void createRule()} type="button">{loading ? t(locale, "保存中...", "Saving...") : t(locale, "保存规则", "Save Rule")}</button></div></Card>
    </CertificateAdminFrame>
  );
}

export function CertificateAdminRecords({ locale, issues, pagination, summary, query, categories }: {
  locale: Locale; issues: CertificateAdminIssue[];
  pagination: { page: number; pageSize: number; total: number };
  summary: { active: number; revoked: number };
  query: { page: number; pageSize: number; search: string; status?: string; category?: string; issuedFrom?: string; issuedTo?: string };
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const rows = issues;

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const [search, setSearch] = useState(query.search);
  const [status, setStatus] = useState(query.status ?? "");
  const [category, setCategory] = useState(query.category ?? "");
  const [issuedFrom, setIssuedFrom] = useState(query.issuedFrom ?? "");
  const [issuedTo, setIssuedTo] = useState(query.issuedTo ?? "");

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDialogTitle, setPreviewDialogTitle] = useState("");
  const [previewDialogSubtitle, setPreviewDialogSubtitle] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  function updateQuery(nextPage = 1) {
    const params = new URLSearchParams();
    params.set("page", String(nextPage)); params.set("pageSize", String(pagination.pageSize));
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status); if (category) params.set("category", category);
    if (issuedFrom) params.set("issuedFrom", issuedFrom); if (issuedTo) params.set("issuedTo", issuedTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleLifecycle(issue: CertificateAdminIssue, action: "revoke" | "restore" | "regenerate") {
    let body: Record<string, string> | undefined;
    if (action === "revoke") {
      const reason = window.prompt(t(locale, "请输入撤销原因（至少 3 个字符）：", "Enter a revocation reason (at least 3 characters):"))?.trim();
      if (!reason) { setActionError(t(locale, "撤销原因不能为空。", "A revocation reason is required.")); return; }
      body = { reason };
    } else if (!window.confirm(action === "restore" ? t(locale, "确认恢复该证书？", "Restore this certificate?") : t(locale, "确认重新生成该证书？", "Regenerate this certificate?"))) return;
    setActionLoadingId(issue.id); setActionError(""); setActionMessage("");
    try {
      const response = await fetch(`/api/admin/certificates/${encodeURIComponent(issue.id)}/${action}`, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setActionError(result.error ?? t(locale, "操作失败。", "Action failed.")); return; }
      setActionMessage(action === "revoke" ? t(locale, "证书已撤销。", "Certificate revoked.") : action === "restore" ? t(locale, "证书已恢复。", "Certificate restored.") : t(locale, "证书已重新生成。", "Certificate regenerated."));
      router.refresh();
    } catch { setActionError(t(locale, "网络错误。", "Network error.")); } finally { setActionLoadingId(null); }
  }

  async function copyVerificationLink(issue: CertificateAdminIssue) {
    const url = `${window.location.origin}/${locale}/verify/certificate/${encodeURIComponent(issue.certificateNumber)}`;
    try { await navigator.clipboard.writeText(url); setActionMessage(t(locale, "验证链接已复制。", "Verification link copied.")); }
    catch { setActionError(t(locale, "无法复制验证链接。", "Unable to copy verification link.")); }
  }

  function closePreviewModal() {
    setPreviewOpen(false);
    setPreviewHtml("");
    setPreviewError("");
    setPreviewDialogTitle("");
    setPreviewDialogSubtitle("");
  }

  useEffect(() => {
    if (!previewOpen) return;
    const handleEsc = (event: KeyboardEvent) => { if (event.key === "Escape") closePreviewModal(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [previewOpen]);

  async function handleDownloadPrint(issue: CertificateAdminIssue) {
    setActionLoadingId(issue.id);
    try {
      window.open(`/api/certificates/${encodeURIComponent(issue.id)}/artifact?disposition=attachment`, "_blank", "noopener,noreferrer");
    } catch {
      setPreviewError(t(locale, "网络错误。", "Network error."));
      setPreviewLoading(false);
    } finally {
      setActionLoadingId(null);
    }
  }

  const startIndex = (pagination.page - 1) * pagination.pageSize + 1;
  const endIndex = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead title={t(locale, "证书记录管理", "Certificate Records")} description={t(locale, "查看所有已生成证书、下载、重新生成、撤销、恢复和复制验证链接。", "Complete history of all issued credentials.")} />
      <div className="cpca-stats compact"><Metric label="Total" value={pagination.total} /><Metric label="Active" value={summary.active} /><Metric label="Revoked" value={summary.revoked} /></div>
      <form className="cpca-filter-row" onSubmit={(event) => { event.preventDefault(); updateQuery(); }}>
        <input aria-label={t(locale, "搜索证书", "Search certificates")} onChange={(event) => setSearch(event.target.value)} placeholder={t(locale, "编号、持有人或邮箱", "Number, holder, or email")} type="search" value={search} />
        <select aria-label={t(locale, "状态", "Status")} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">{t(locale, "全部状态", "All statuses")}</option>{["DRAFT", "PENDING_APPROVAL", "APPROVED", "GENERATED", "ISSUED", "REVOKED"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label={t(locale, "分类", "Category")} onChange={(event) => setCategory(event.target.value)} value={category}><option value="">{t(locale, "全部分类", "All categories")}</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input aria-label={t(locale, "起始签发日期", "Issue date from")} onChange={(event) => setIssuedFrom(event.target.value)} type="date" value={issuedFrom} /><input aria-label={t(locale, "结束签发日期", "Issue date to")} onChange={(event) => setIssuedTo(event.target.value)} type="date" value={issuedTo} />
        <button className="cpca-btn cpca-btn-outline" type="submit">{t(locale, "筛选", "Filter")}</button>
      </form>
      {actionMessage ? <FormSuccessText>{actionMessage}</FormSuccessText> : null}{actionError ? <FormErrorText>{actionError}</FormErrorText> : null}
      <Card>
        <div className="cpca-table-wrap">
          <table className="cpca-table">
            <thead><tr><th>{t(locale, "证书编号", "Cert Number")}</th><th>{t(locale, "证书名称", "Certificate Name")}</th><th>{t(locale, "持有人", "Holder")}</th><th>{t(locale, "签发日期", "Issue Date")}</th><th>{t(locale, "来源", "Source")}</th><th>{t(locale, "状态", "Status")}</th><th>{t(locale, "验证次数", "Verifications")}</th><th>{t(locale, "操作", "Actions")}</th></tr></thead>
            <tbody>
              {rows.map((issue) => (
                <tr key={issue.id}>
                  <td className="cpca-mono">{issue.certificateNumber}</td>
                  <td>{issue.certificateName}</td>
                  <td>{issue.holderName}</td>
                  <td>{issue.issueDate}</td>
                  <td>{issue.source ?? "Manual"}</td>
                  <td><StatusBadge status={issue.status}>{issue.status}</StatusBadge></td>
                  <td>{issue.verificationCount ?? 0}</td>
                  <td>
                    <div className="cpca-actions compact"><button
                      className="cpca-btn cpca-btn-ghost"
                      disabled={actionLoadingId === issue.id}
                      onClick={() => void handleDownloadPrint(issue)}
                      type="button"
                    >
                      {actionLoadingId === issue.id
                        ? t(locale, "加载中...", "Loading...")
                        : t(locale, "下载/打印", "Download/Print")}
                    </button><button className="cpca-btn cpca-btn-ghost" onClick={() => void copyVerificationLink(issue)} type="button">{t(locale, "复制链接", "Copy link")}</button>
                    {issue.status === "REVOKED" ? <button className="cpca-btn cpca-btn-outline" disabled={actionLoadingId === issue.id} onClick={() => void handleLifecycle(issue, "restore")} type="button">{t(locale, "恢复", "Restore")}</button> : <><button className="cpca-btn cpca-btn-danger" disabled={actionLoadingId === issue.id} onClick={() => void handleLifecycle(issue, "revoke")} type="button">{t(locale, "撤销", "Revoke")}</button><button className="cpca-btn cpca-btn-ghost" disabled={actionLoadingId === issue.id} onClick={() => void handleLifecycle(issue, "regenerate")} type="button">{t(locale, "重新生成", "Regenerate")}</button></>}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {/* Pagination */}
      <div className="cpca-pager">
        <span>
          {rows.length === 0
            ? t(locale, "暂无记录", "No records")
            : t(locale, `显示 ${startIndex}–${endIndex}，共 ${pagination.total} 条`, `Showing ${startIndex}–${endIndex} of ${pagination.total}`)}
        </span>
        <div>
          <button
            className={pagination.page === 1 ? "cpca-btn cpca-btn-ghost" : "cpca-btn cpca-btn-outline"}
            disabled={pagination.page === 1}
            onClick={() => updateQuery(Math.max(1, pagination.page - 1))}
            type="button"
          >
            {t(locale, "上一页", "Prev")}
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - pagination.page) <= 2)
            .reduce<Array<number | "…">>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === "…"
                ? <span key={`ellipsis-${idx}`} style={{ padding: "0 4px", color: "var(--cp-text-muted)" }}>…</span>
                : <button key={item} className={`cpca-btn ${pagination.page === item ? "cpca-btn-amber" : "cpca-btn-ghost"}`} onClick={() => updateQuery(item as number)} type="button">{item}</button>
            )}
          <button
            className={pagination.page === totalPages ? "cpca-btn cpca-btn-ghost" : "cpca-btn cpca-btn-outline"}
            disabled={pagination.page === totalPages}
            onClick={() => updateQuery(Math.min(totalPages, pagination.page + 1))}
            type="button"
          >
            {t(locale, "下一页", "Next")}
          </button>
        </div>
      </div>
      {/* Preview/Print modal */}
      {previewOpen ? (
        <div className="cpca-preview-modal" onClick={closePreviewModal} role="presentation">
          <div className="cpca-preview-modal-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={t(locale, "证书预览", "Certificate preview")}>
            <div className="cpca-preview-modal-head">
              <div>
                <strong>{previewDialogTitle || t(locale, "证书预览", "Certificate preview")}</strong>
                <small>{previewDialogSubtitle}</small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!previewLoading && previewHtml ? (
                  <button
                    className="cpca-btn cpca-btn-outline"
                    onClick={() => {
                      const iframe = document.querySelector<HTMLIFrameElement>(".cpca-preview-modal-frame");
                      iframe?.contentWindow?.print();
                    }}
                    type="button"
                  >
                    {t(locale, "打印", "Print")}
                  </button>
                ) : null}
                <button className="cpca-btn cpca-btn-ghost" onClick={closePreviewModal} type="button">
                  {t(locale, "关闭", "Close")}
                </button>
              </div>
            </div>
            <div className="cpca-preview-modal-body">
              {previewLoading ? <FormHelpText>{t(locale, "证书加载中...", "Loading certificate...")}</FormHelpText> : null}
              {previewError ? <FormErrorText>{previewError}</FormErrorText> : null}
              {!previewLoading && !previewError && previewHtml ? (
                <iframe className="cpca-preview-modal-frame" sandbox="allow-scripts allow-modals" srcDoc={previewHtml} title={t(locale, "证书预览", "Certificate preview")} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </CertificateAdminFrame>
  );
}

export function CertificateAdminAuditLogs({ locale, verifications, auditLogs }: { locale: Locale; verifications: CertificateAdminAuditLog[]; auditLogs: CertificateAdminAuditLog[] }) {
  const [tab, setTab] = useState<"verify" | "admin">("verify");
  const rows = tab === "verify" ? verifications : auditLogs;
  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead title={t(locale, "验证与审计日志", "Verification & Audit Logs")} description={t(locale, "记录证书验证、下载、撤销、模板修改和批量签发等可信操作。", "Track credential verifications and administrative operations.")} />
      <div className="cpca-stats compact"><Metric label={t(locale, "今日验证", "Today's Verifications")} value={verifications.length} /><Metric label={t(locale, "成功率", "Success Rate")} value="94.2%" /><Metric label={t(locale, "异常", "Anomalies Detected")} value="2" /></div>
      <div className="cpca-tab-row"><button className="cpca-btn" onClick={() => setTab("verify")} type="button">{t(locale, "验证日志", "Verification Log")}</button><button className="cpca-btn" onClick={() => setTab("admin")} type="button">{t(locale, "后台操作", "Admin Operations")}</button></div>
      <Card><div className="cpca-table-wrap"><table className="cpca-table"><thead><tr><th>{t(locale, "时间", "Timestamp")}</th><th>{tab === "verify" ? t(locale, "证书", "Certificate") : "Admin"}</th><th>{tab === "verify" ? t(locale, "持有人", "Holder") : "Action"}</th><th>{t(locale, "结果", "Result")}</th><th>{t(locale, "方式", "Method")}</th><th>{t(locale, "地区", "Source Region")}</th></tr></thead><tbody>{rows.map((log) => <tr key={log.id}><td className="cpca-muted">{log.time}</td><td className="cpca-strong">{log.primary}</td><td>{log.secondary}</td><td><StatusBadge status={log.result}>{log.result}</StatusBadge></td><td>{log.channel ?? "URL Link"}</td><td>{log.region ?? "Unknown"}</td></tr>)}</tbody></table></div></Card>
    </CertificateAdminFrame>
  );
}

function fallbackCategories(locale: Locale): CertificateAdminCategory[] {
  const names = [
    ["课程证书", "Course Certificate"],
    ["活动出席证书", "Event Attendance"],
    ["演讲嘉宾证书", "Speaker Certificate"],
    ["主持人证书", "Moderator Certificate"],
    ["志愿者证书", "Volunteer Certificate"],
    ["导师证书", "Mentor Certificate"],
    ["学习体验证书", "Learning Experience"],
    ["成就徽章", "Achievement Badge"],
    ["里程碑证书", "Milestone Credential"],
    ["气候行动记录", "Climate Action Record"],
  ];
  return names.map(([zh, en], index) => ({ id: `fallback-${index}`, key: en.toLowerCase().replaceAll(" ", "-"), name: zh, nameEn: en, isActive: index !== 9, order: index + 1, autoIssueEnabled: index !== 2, userRequestEnabled: index === 2 || index === 4, pdfEnabled: true, publicVerifyEnabled: true, createdAt: new Date(Date.now() - index * 86400000).toISOString(), templateCount: 10 - index, definitionCount: index + 1, issuedCount: Math.max(0, 18 - index * 2) }));
}

function fallbackTemplates(locale: Locale): CertificateAdminTemplate[] {
  return ["SHCW Official Certificate", "Course Completion - Standard", "Speaker Certificate - Premium", "Achievement Badge - Round", "Volunteer Service - Basic", "Digital Micro-Credential"].map((name, index) => ({ id: `fallback-template-${index}`, name, nameEn: name, templateType: index === 3 ? "ACHIEVEMENT" : index === 5 ? "CUSTOM" : "ATTENDANCE", isActive: index !== 5, version: 1, updatedAt: new Date(Date.now() - index * 43200000).toISOString(), issuedCount: [2847, 1203, 428, 892, 471, 0][index] }));
}

function fallbackIssues(locale: Locale): CertificateAdminIssue[] {
  return ["Lin Wei", "Sarah H.", "James O.", "Aiko T.", "Wang Fang", "Robert K."].map((holder, index) => ({ id: `fallback-issue-${index}`, certificateNumber: `CP-CERT-2026-00943${index}`, certificateName: ["FSA Credential - Level I", "SHCW 2026 Attendance", "Ocean Stewardship", "Youth Forum Speaker", "Volunteer - SHCW 2026", "Green Finance Moderator"][index], categoryName: ["Course Certificate", "Event Attendance", "Learning Experience", "Speaker Certificate", "Volunteer Certificate", "Moderator Certificate"][index], holderName: holder, holderEmail: `${holder.toLowerCase().replaceAll(" ", ".")}@example.com`, issueDate: "May 23, 2026", status: index === 2 ? "Pending" : index === 5 ? "Revoked" : "Issued", source: index % 2 ? "Manual" : "Auto", verificationCount: index + 1 }));
}

function fallbackLogs(locale: Locale): CertificateAdminAuditLog[] {
  return fallbackIssues(locale).map((issue, index) => ({ id: `fallback-log-${index}`, time: `May 23, ${14 - index}:32`, primary: issue.certificateName, secondary: issue.holderName, result: issue.status === "Revoked" ? "Revoked" : "Valid", channel: index % 2 ? "URL Link" : "QR Code", region: ["Shanghai, CN", "London, UK", "Unknown", "Tokyo, JP", "Beijing, CN", "Hong Kong"][index] }));
}

function fallbackAdminLogs(locale: Locale): CertificateAdminAuditLog[] {
  return ["Issued", "Revoked", "Modified", "Approved", "Created", "Updated"].map((result, index) => ({ id: `fallback-admin-log-${index}`, time: `May 23, ${14 - index}:00`, primary: "Wei Zhang", secondary: ["Batch issue", "Administrative decision", "Updated signature block", "Volunteer certificate", "New template draft", "Rule threshold changed"][index], result, channel: "Admin", region: "Climate Passport" }));
}
