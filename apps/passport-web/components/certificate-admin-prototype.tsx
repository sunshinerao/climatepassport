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
  if (normalized.includes("revoked") || normalized.includes("rejected")) return "cpca-badge cpca-badge-red";
  if (normalized.includes("pending") || normalized.includes("draft") || normalized.includes("expired")) return "cpca-badge cpca-badge-amber";
  if (normalized.includes("needs")) return "cpca-badge cpca-badge-blue";
  return "cpca-badge cpca-badge-green";
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
  const rows = categories;
  const [sortMode, setSortMode] = useState<"latest" | "most-issued">("latest");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CertificateAdminCategory | null>(null);
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
                  <td><StatusBadge status={category.isActive ? "Active" : "Draft"}>{category.isActive ? "Active" : "Draft"}</StatusBadge></td>
                  <td>
                    <button className="cpca-btn cpca-btn-ghost" onClick={() => setSelectedCategory(category)} type="button">
                      {t(locale, "编辑", "Edit")}
                    </button>
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
  const [removedTemplateIds, setRemovedTemplateIds] = useState<Set<string>>(new Set());
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

  const visibleRows = sortedRows.filter((template) => !removedTemplateIds.has(template.id));

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

      setRemovedTemplateIds((previous) => new Set(previous).add(template.id));
      router.refresh();
    } catch {
      setListError(t(locale, "网络错误。", "Network error."));
    } finally {
      setDeletingTemplateId(null);
    }
  }

  async function handleDuplicateTemplate(template: CertificateAdminTemplate) {
    if (!template.categoryId) {
      setListError(t(locale, "模板缺少分类信息，无法复制。", "Template category is missing and cannot be duplicated."));
      return;
    }

    setDuplicatingTemplateId(template.id);
    setListMessage("");
    setListError("");

    const zhSuffix = "（副本）";
    const enSuffix = " (Copy)";

    const payload = {
      categoryId: template.categoryId,
      name: `${template.name}${zhSuffix}`,
      nameEn: template.nameEn ? `${template.nameEn}${enSuffix}` : null,
      templateType: template.templateType,
      issuerName: template.renderConfig?.issuerName ?? null,
      pageSize: template.renderConfig?.pageSize ?? "A4_LANDSCAPE",
      pageWidthMm: template.renderConfig?.pageWidthMm ?? null,
      pageHeightMm: template.renderConfig?.pageHeightMm ?? null,
      accentColor: template.renderConfig?.accentColor ?? null,
      backgroundColor: template.renderConfig?.backgroundColor ?? null,
      backgroundImageUrl: template.renderConfig?.backgroundImageUrl ?? null,
      logoImageUrl: template.renderConfig?.logoImageUrl ?? null,
      signatureImageUrl: template.renderConfig?.signatureImageUrl ?? null,
      sealImageUrl: template.renderConfig?.sealImageUrl ?? null,
      elements: Array.isArray(template.renderConfig?.elements) ? template.renderConfig?.elements : undefined,
      isActive: template.isActive,
      definitionName: template.definition?.name ? `${template.definition.name}${zhSuffix}` : `${template.name}${zhSuffix}`,
      definitionNameEn: template.definition?.nameEn ? `${template.definition.nameEn}${enSuffix}` : null,
      approvalMode: template.definition?.approvalMode ?? "auto",
    };

    try {
      const response = await fetch("/api/admin/certificates/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

      setListMessage(t(locale, "模板已复制，请在下方编辑器继续调整。", "Template duplicated. Continue editing in the editor below."));
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
              <div className="cpca-template-meta"><StatusBadge status={template.isActive ? "Active" : "Draft"}>{template.isActive ? "Active" : "Draft"}</StatusBadge><span>v{template.version}</span><span>{template.nameEn ? "EN/ZH" : "ZH"}</span><span>{getTemplateLayoutLabel(locale, template)}</span></div>
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
}: {
  locale: Locale;
  templates: CertificateAdminTemplate[];
  recentIssues: CertificateAdminIssue[];
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

  async function issueBatchCertificates() {
    setBatchMessage("");
    const parsedEmails = parseManualIssueEmails(batchEmails);

    if (!templateId || parsedEmails.length === 0) {
      setBatchMessage(t(locale, "请选择模板并填写至少一个邮箱。", "Select a template and enter at least one email."));
      return;
    }

    setBatchLoading(true);

    try {
      const response = await fetch("/api/admin/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          emails: parsedEmails,
          issueDate: batchIssueDate,
          variableValues: normalizeManualVariablePayload(batchVariableValues),
        }),
      });

      let result: {
        error?: string;
        summary?: { total: number; succeeded: number; failed: number };
        results?: Array<{ email: string; error?: string }>;
      } = {};
      const responseType = response.headers.get("content-type") ?? "";

      if (responseType.includes("application/json")) {
        result = (await response.json()) as {
          error?: string;
          summary?: { total: number; succeeded: number; failed: number };
          results?: Array<{ email: string; error?: string }>;
        };
      } else if (!response.ok) {
        const rawError = await response.text();
        if (rawError.trim()) {
          result.error = rawError;
        }
      }

      if (!response.ok) {
        setBatchMessage(result.error ?? t(locale, "批量签发失败", "Batch issue failed"));
        return;
      }

      const summaryText = result.summary
        ? `${t(locale, "批量签发完成", "Batch issue completed")}: ${result.summary.succeeded}/${result.summary.total}`
        : t(locale, "批量签发完成", "Batch issue completed");
      const failedRows = (result.results ?? []).filter((item) => item.error).slice(0, 3);
      const failedText = failedRows.length
        ? ` ${t(locale, "失败", "Failed")}: ${failedRows.map((item) => `${item.email} (${item.error})`).join("; ")}`
        : "";
      setBatchMessage(`${summaryText}${failedText}`);

      if (result.summary?.failed === 0) {
        setBatchEmails("");
      }
      router.refresh();
    } catch {
      setBatchMessage(t(locale, "网络错误", "Network error"));
    } finally {
      setBatchLoading(false);
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
      if (issue.generatedFileUrl) {
        const html = decodeHtmlDataUrl(issue.generatedFileUrl);
        if (html) {
          setPreviewOpen(true);
          setPreviewLoading(false);
          setPreviewError("");
          setPreviewHtml(html);
          setPreviewDialogTitle(issue.certificateName || t(locale, "证书预览", "Certificate preview"));
          setPreviewDialogSubtitle(issue.certificateNumber || "");
        } else {
          window.open(issue.generatedFileUrl, "_blank", "noopener,noreferrer");
        }
        return;
      }

      const response = await fetch(`/api/certificates/${encodeURIComponent(issue.id)}/download`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        download?: { url?: string | null; verificationCode?: string | null };
      };

      if (!response.ok) {
        setMessage(result.error ?? t(locale, "下载失败。", "Download failed."));
        return;
      }

      if (result.download?.url) {
        const html = decodeHtmlDataUrl(result.download.url);
        if (html) {
          setPreviewOpen(true);
          setPreviewLoading(false);
          setPreviewError("");
          setPreviewHtml(html);
          setPreviewDialogTitle(issue.certificateName || t(locale, "证书预览", "Certificate preview"));
          setPreviewDialogSubtitle(issue.certificateNumber || result.download.verificationCode || "");
        } else {
          window.open(result.download.url, "_blank", "noopener,noreferrer");
        }
      }
      router.refresh();
    } catch {
      setMessage(t(locale, "网络错误。", "Network error."));
    } finally {
      setRecordActionLoadingId(null);
    }
  }

  async function revokeIssuedCertificate(issue: CertificateAdminIssue) {
    setMessage("");
    setRecordActionLoadingId(issue.id);
    try {
      const response = await fetch(`/api/admin/certificates/${encodeURIComponent(issue.id)}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  async function deleteIssuedCertificate(issue: CertificateAdminIssue) {
    const confirmed = window.confirm(t(locale, "确认删除该证书记录？", "Delete this certificate record?"));
    if (!confirmed) {
      return;
    }

    setMessage("");
    setRecordActionLoadingId(issue.id);
    try {
      const response = await fetch(`/api/admin/certificates/${encodeURIComponent(issue.id)}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(result.error ?? t(locale, "删除失败。", "Delete failed."));
        return;
      }

      setMessage(t(locale, "证书已删除。", "Certificate deleted."));
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
            <label><span>{t(locale, "证书模板", "Certificate Template")}</span><select onChange={(event) => setTemplateId(event.target.value)} value={templateId}><option value="">{t(locale, "选择模板", "Select template...")}</option>{activeTemplates.map((template) => <option key={template.id} value={template.id}>{localName(locale, template)}</option>)}</select></label>
            <label><span>{t(locale, "分类", "Category")}</span><input readOnly value={selectedTemplate ? (localName(locale, { name: selectedTemplate.categoryName ?? "", nameEn: selectedTemplate.categoryNameEn ?? null })) : t(locale, "从模板自动匹配", "Auto-filled from template")} /></label>
            <label><span>{t(locale, "签发日期", "Issue Date")}</span><input onChange={(event) => setBatchIssueDate(event.target.value)} type="date" value={batchIssueDate} /></label>
            <label className="wide"><span>{t(locale, "收件人邮箱（每行一个，或用逗号分隔）", "Recipient emails (one per line or comma-separated)")}</span><textarea onChange={(event) => setBatchEmails(event.target.value)} rows={6} value={batchEmails} /></label>
          </div>
          {renderVariableInputs(batchVariableValues, setBatchVariableValues)}
          {batchMessage ? <FormMessageText>{batchMessage}</FormMessageText> : null}
          <div className="cpca-actions"><button className="cpca-btn cpca-btn-amber" disabled={batchLoading} onClick={issueBatchCertificates} type="button">{batchLoading ? t(locale, "批量签发中...", "Issuing batch...") : t(locale, "确认批量签发", "Confirm Batch Issue")}</button></div>
        </Card>
      )}
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
                      <button
                        className="cpca-btn cpca-btn-danger"
                        disabled={recordActionLoadingId === issue.id}
                        onClick={() => void deleteIssuedCertificate(issue)}
                        type="button"
                      >
                        {t(locale, "删除", "Delete")}
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

export function CertificateAdminApplications({ locale, issues }: { locale: Locale; issues: CertificateAdminIssue[] }) {
  const rows = issues;
  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead title={t(locale, "证书申请审核", "Certificate Applications")} description={t(locale, "审核用户主动提交的证书、志愿服务、项目完成和活动参与证明申请。", "Review user-initiated certificate requests.")} />
      <div className="cpca-tab-row"><button className="cpca-btn" type="button">All ({rows.length})</button><button className="cpca-btn" type="button">Pending</button><button className="cpca-btn" type="button">Approved</button><button className="cpca-btn" type="button">Rejected</button><button className="cpca-btn" type="button">Needs Info</button></div>
      <Card><div className="cpca-table-wrap"><table className="cpca-table"><thead><tr><th>{t(locale, "申请人", "Applicant")}</th><th>{t(locale, "证书类型", "Certificate Type")}</th><th>{t(locale, "项目 / 活动", "Program / Event")}</th><th>{t(locale, "提交时间", "Submitted")}</th><th>{t(locale, "附件", "Attachments")}</th><th>{t(locale, "状态", "Status")}</th><th>{t(locale, "操作", "Actions")}</th></tr></thead><tbody>{rows.slice(0, 8).map((issue, index) => <tr key={issue.id}><td><span className="cpca-strong">{issue.holderName}</span><small>{issue.holderEmail ?? "applicant@example.com"}</small></td><td>{issue.categoryName}</td><td>{issue.source ?? "Climate Passport"}</td><td>{issue.issueDate}</td><td>{index % 2 ? "1 file" : "—"}</td><td><StatusBadge status={issue.status}>{issue.status}</StatusBadge></td><td><div className="cpca-actions compact"><button className="cpca-btn cpca-btn-success" type="button">{t(locale, "通过", "Approve")}</button><button className="cpca-btn cpca-btn-danger" type="button">{t(locale, "拒绝", "Reject")}</button></div></td></tr>)}</tbody></table></div></Card>
    </CertificateAdminFrame>
  );
}

export function CertificateAdminRules({ locale, templates }: { locale: Locale; templates: CertificateAdminTemplate[] }) {
  const rules = [
    ["Course Completion Auto-Issue", "Course", "All modules complete", "Course Standard", "Yes", "No", "Active"],
    ["Event Check-in Certificate", "Event", "Successful check-in", "SHCW Official", "Yes", "No", "Active"],
    ["Speaker Auto-Certificate", "Event", "Role=Speaker + complete", "Speaker Premium", "Yes", "Yes", "Active"],
    ["LE Program Milestone", "Learning Exp.", "All stages complete", "Milestone Cred.", "Yes", "Yes", "Active"],
    ["1000 Points Level Badge", "Points", "Points >= 1000", "Achievement Badge", "Yes", "No", "Active"],
    ["Volunteer 50hrs Badge", "Volunteer", "Hours >= 50", "Volunteer Service", "Yes", "No", "Draft"],
  ];
  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead title={t(locale, "自动签发规则", "Automatic Issuing Rules")} description={t(locale, "配置课程、活动、Learning Experience、积分和人工审核触发条件。", "Configure trigger conditions for auto-issuing certificates.")} action={<button className="cpca-btn cpca-btn-amber" type="button">+ {t(locale, "创建规则", "Create Rule")}</button>} />
      <Card><div className="cpca-table-wrap"><table className="cpca-table"><thead><tr><th>{t(locale, "规则名称", "Rule Name")}</th><th>{t(locale, "触发", "Trigger")}</th><th>{t(locale, "条件", "Condition")}</th><th>{t(locale, "模板", "Template")}</th><th>{t(locale, "通知", "Notify")}</th><th>{t(locale, "确认", "Confirm")}</th><th>{t(locale, "状态", "Status")}</th><th>{t(locale, "操作", "Actions")}</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule[0]}><td className="cpca-strong">{rule[0]}</td><td>{rule[1]}</td><td>{rule[2]}</td><td>{templates[0] ? localName(locale, templates[0]) : rule[3]}</td><td><span className="cpca-badge cpca-badge-green">{rule[4]}</span></td><td><span className="cpca-badge cpca-badge-gray">{rule[5]}</span></td><td><StatusBadge status={rule[6]}>{rule[6]}</StatusBadge></td><td><button className="cpca-btn cpca-btn-ghost" type="button">{t(locale, "编辑", "Edit")}</button></td></tr>)}</tbody></table></div></Card>
      <Card title={t(locale, "创建签发规则", "Create Issuing Rule")}><div className="cpca-form-grid"><label><span>{t(locale, "规则名称", "Rule Name")}</span><input placeholder="Course Completion Auto-Issue" /></label><label><span>{t(locale, "触发来源", "Trigger Source")}</span><select><option>Course</option><option>Event</option><option>Learning Experience</option><option>Points</option><option>Manual Review</option></select></label><label className="wide"><span>{t(locale, "触发条件", "Trigger Condition")}</span><input placeholder="All modules complete, Points >= 1000" /></label><label><span>{t(locale, "证书模板", "Certificate Template")}</span><select>{templates.map((template) => <option key={template.id}>{localName(locale, template)}</option>)}</select></label><label><span>{t(locale, "签发时间", "Issue Timing")}</span><select><option>Immediate</option><option>Next Business Day</option><option>Manual Review</option></select></label></div><div className="cpca-toggle-row"><label><input defaultChecked type="checkbox" /> Admin Confirmation Required</label><label><input defaultChecked type="checkbox" /> Auto-notify User</label><label><input defaultChecked type="checkbox" /> Allow PDF Download</label><label><input type="checkbox" /> Public Display</label></div></Card>
    </CertificateAdminFrame>
  );
}

export function CertificateAdminRecords({ locale, issues }: { locale: Locale; issues: CertificateAdminIssue[] }) {
  const rows = issues;
  const active = rows.filter((issue) => !issue.status.toLowerCase().includes("revoked")).length;
  const revoked = rows.filter((issue) => issue.status.toLowerCase().includes("revoked")).length;
  return (
    <CertificateAdminFrame locale={locale} hideSectionLinks>
      <PageHead title={t(locale, "证书记录管理", "Certificate Records")} description={t(locale, "查看所有已生成证书、下载、重新生成、撤销、恢复和复制验证链接。", "Complete history of all issued credentials.")} />
      <div className="cpca-stats compact"><Metric label="Total" value={rows.length} /><Metric label="Active" value={active} /><Metric label="Expired" value="0" /><Metric label="Revoked" value={revoked} /></div>
      <div className="cpca-filter-row"><input placeholder={t(locale, "搜索证书编号...", "Search certificate number...")} /><select><option>All Status</option><option>Active</option><option>Revoked</option></select><select><option>All Categories</option></select><input type="date" /><button className="cpca-btn cpca-btn-outline" type="button">Export CSV</button></div>
      <Card><div className="cpca-table-wrap"><table className="cpca-table"><thead><tr><th>{t(locale, "证书编号", "Cert Number")}</th><th>{t(locale, "证书名称", "Certificate Name")}</th><th>{t(locale, "持有人", "Holder")}</th><th>{t(locale, "签发日期", "Issue Date")}</th><th>{t(locale, "来源", "Source")}</th><th>{t(locale, "状态", "Status")}</th><th>{t(locale, "验证次数", "Verifications")}</th><th>{t(locale, "操作", "Actions")}</th></tr></thead><tbody>{rows.map((issue) => <tr key={issue.id}><td className="cpca-mono">{issue.certificateNumber}</td><td>{issue.certificateName}</td><td>{issue.holderName}</td><td>{issue.issueDate}</td><td>{issue.source ?? "Manual"}</td><td><StatusBadge status={issue.status}>{issue.status}</StatusBadge></td><td>{issue.verificationCount ?? 0}</td><td><Link className="cpca-btn cpca-btn-ghost" href={`/${locale}/dashboard/certificates/${issue.id}`}>{t(locale, "操作", "Actions")} ▾</Link></td></tr>)}</tbody></table></div></Card>
      <div className="cpca-pager"><span>{t(locale, "显示", "Showing")} 1-{rows.length} of {rows.length}</span><div><button className="active">1</button><button>2</button><button>3</button></div></div>
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
