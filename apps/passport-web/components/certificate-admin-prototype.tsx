"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/site-content";

export type CertificateAdminCategory = {
  id: string;
  key: string;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  isActive: boolean;
  templateCount?: number;
  definitionCount?: number;
};

export type CertificateAdminTemplate = {
  id: string;
  name: string;
  nameEn?: string | null;
  templateType: string;
  isActive: boolean;
  version: number;
  categoryName?: string | null;
  categoryNameEn?: string | null;
  issuedCount?: number;
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

function CertificateModuleNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const prefix = `/${locale}`;
  const activeSection = certificateAdminSections.find((section) => pathname === `${prefix}${section.href}`) ?? certificateAdminSections[0];

  return (
    <div className="cpca-module-nav" aria-label={t(locale, "证书中心导航", "Certificate module navigation")}>
      <div className="cpca-breadcrumb">
        <span>Climate Passport</span>
        <span aria-hidden="true">›</span>
        <span>{t(locale, "证书中心", "Certificates")}</span>
        <span aria-hidden="true">›</span>
        <strong>{t(locale, activeSection.zh, activeSection.en)}</strong>
      </div>
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
    </div>
  );
}

function CertificateAdminFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <div className="cpca">
      <CertificateModuleNav locale={locale} />
      {children}
    </div>
  );
}

function localName(locale: Locale, item: { name: string; nameEn?: string | null }) {
  return locale === "zh" ? item.name : item.nameEn ?? item.name;
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
    <CertificateAdminFrame locale={locale}>
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
              {(popular.length ? popular : fallbackCategories(locale)).map((category, index) => {
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
                  {(recent.length ? recent : fallbackIssues(locale)).map((issue) => (
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
  form: ReactNode;
}) {
  const rows = categories.length ? categories : fallbackCategories(locale);
  return (
    <CertificateAdminFrame locale={locale}>
      <PageHead
        title={t(locale, "证书分类管理", "Certificate Categories")}
        description={t(locale, "管理证书类型，以及自动签发、用户申请、PDF 下载和公开验证能力。", "Manage credential types and their configurations.")}
        action={<a className="cpca-btn cpca-btn-amber" href="#category-form">+ {t(locale, "新增分类", "New Category")}</a>}
      />
      <Card>
        <div className="cpca-table-wrap">
          <table className="cpca-table">
            <thead><tr><th>{t(locale, "分类", "Category")}</th><th>{t(locale, "英文名", "English Name")}</th><th>{t(locale, "自动签发", "Auto-Issue")}</th><th>{t(locale, "用户申请", "User Request")}</th><th>PDF</th><th>{t(locale, "公开验证", "Public Verify")}</th><th>{t(locale, "状态", "Status")}</th><th>{t(locale, "操作", "Actions")}</th></tr></thead>
            <tbody>
              {rows.map((category, index) => (
                <tr key={category.id}>
                  <td className="cpca-strong">{category.name}</td>
                  <td>{category.nameEn ?? category.name}</td>
                  <td><input checked={index !== 2 && category.isActive} readOnly type="checkbox" /></td>
                  <td><input checked={[2, 4].includes(index)} readOnly type="checkbox" /></td>
                  <td><input checked={index !== 7} readOnly type="checkbox" /></td>
                  <td><input checked={category.isActive} readOnly type="checkbox" /></td>
                  <td><StatusBadge status={category.isActive ? "Active" : "Draft"}>{category.isActive ? "Active" : "Draft"}</StatusBadge></td>
                  <td><button className="cpca-btn cpca-btn-ghost" type="button">{t(locale, "编辑", "Edit")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <section className="cpca-card cpca-form-card" id="category-form">
        <div className="cpca-card-head"><h2>{t(locale, "新增分类", "Create Category")}</h2></div>
        <div className="cpca-card-body">{form}</div>
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
  form: ReactNode;
}) {
  const rows = templates.length ? templates : fallbackTemplates(locale);
  return (
    <CertificateAdminFrame locale={locale}>
      <PageHead
        title={t(locale, "证书模板管理", "Certificate Templates")}
        description={t(locale, "设计和管理证书背景、变量、签名、印章、二维码和打印版式。", "Design and manage credential templates.")}
        action={<a className="cpca-btn cpca-btn-amber" href="#template-editor">+ {t(locale, "新增模板", "New Template")}</a>}
      />
      <div className="cpca-template-grid">
        {rows.slice(0, 6).map((template, index) => (
          <article className="cpca-template-card" key={template.id}>
            <div className={`cpca-template-thumb tone-${index % 6}`}><div>{template.templateType === "ACHIEVEMENT" ? "Badge" : template.templateType === "CUSTOM" ? "Digital Card" : "A4 Landscape"}</div></div>
            <div className="cpca-template-body">
              <h3>{localName(locale, template)}</h3>
              <div className="cpca-template-meta"><StatusBadge status={template.isActive ? "Active" : "Draft"}>{template.isActive ? "Active" : "Draft"}</StatusBadge><span>v{template.version}</span><span>{template.nameEn ? "EN/ZH" : "ZH"}</span></div>
              <small>{template.issuedCount ?? 0} {t(locale, "已签发", "issued")}</small>
              <div className="cpca-actions"><Link className="cpca-btn cpca-btn-outline" href={`/${locale}/admin/certificates/templates/${template.id}`}>{t(locale, "编辑", "Edit")}</Link><Link className="cpca-btn cpca-btn-ghost" href={`/${locale}/admin/certificates/templates/${template.id}`}>{t(locale, "预览", "Preview")}</Link><button className="cpca-btn cpca-btn-ghost" type="button">{t(locale, "复制", "Duplicate")}</button></div>
            </div>
          </article>
        ))}
      </div>
      <section className="cpca-card cpca-form-card" id="template-editor">
        <div className="cpca-card-head"><h2>{t(locale, "模板编辑器", "Template Editor")}</h2></div>
        <div className="cpca-card-body">{form}</div>
      </section>
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
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [email, setEmail] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const activeTemplates = templates.filter((template) => template.isActive);

  async function issueCertificate() {
    setMessage("");
    if (!email || !templateId) {
      setMessage(t(locale, "请填写收件人邮箱并选择模板。", "Enter a recipient email and select a template."));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/admin/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, templateId }),
      });
      const result = await response.json() as { error?: string; verificationCode?: string };
      setMessage(response.ok ? `${t(locale, "已签发", "Issued")}: ${result.verificationCode ?? ""}` : result.error ?? t(locale, "签发失败", "Issue failed"));
      if (response.ok) setEmail("");
    } catch {
      setMessage(t(locale, "网络错误", "Network error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <CertificateAdminFrame locale={locale}>
      <PageHead title={t(locale, "证书签发", "Issue Certificates")} description={t(locale, "向单个用户或批量名单签发可验证数字证书。", "Single or batch issue credentials to users.")} />
      <div className="cpca-tab-row"><button className={`cpca-btn ${mode === "single" ? "cpca-btn-amber" : "cpca-btn-outline"}`} onClick={() => setMode("single")} type="button">{t(locale, "单个签发", "Single Issue")}</button><button className={`cpca-btn ${mode === "batch" ? "cpca-btn-amber" : "cpca-btn-outline"}`} onClick={() => setMode("batch")} type="button">{t(locale, "批量签发", "Batch Issue")}</button></div>
      {mode === "single" ? (
        <Card>
          <div className="cpca-form-grid">
            <label><span>{t(locale, "证书模板", "Certificate Template")}</span><select value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">{t(locale, "选择模板", "Select template...")}</option>{activeTemplates.map((template) => <option key={template.id} value={template.id}>{localName(locale, template)}</option>)}</select></label>
            <label><span>{t(locale, "分类", "Category")}</span><select><option>{t(locale, "从模板自动匹配", "Auto-filled from template")}</option></select></label>
            <label className="wide"><span>{t(locale, "关联项目 / 活动 / 课程", "Related Program / Event / Course")}</span><select><option>Climate Passport record</option><option>Shanghai Climate Week 2026</option><option>FSA Credential Program</option></select></label>
            <label><span>{t(locale, "收件人邮箱", "Recipient email")}</span><input onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" type="email" value={email} /></label>
            <label><span>{t(locale, "角色", "Role")}</span><input placeholder={t(locale, "例如 Speaker / Volunteer", "e.g. Speaker, Moderator, Volunteer")} /></label>
            <label><span>{t(locale, "证书名称", "Certificate Name")}</span><input placeholder={t(locale, "从模板自动填充", "Auto-filled from template")} /></label>
            <label><span>{t(locale, "证书编号", "Certificate Number")}</span><input readOnly value="CV-{AUTO-GENERATED}" /></label>
            <label><span>{t(locale, "签发日期", "Issue Date")}</span><input type="date" /></label>
            <label><span>{t(locale, "有效期", "Expiry Date")}</span><input type="date" /></label>
          </div>
          {message ? <p className="cpca-message">{message}</p> : null}
          <div className="cpca-actions"><button className="cpca-btn cpca-btn-outline" type="button">{t(locale, "预览证书", "Preview Certificate")}</button><button className="cpca-btn cpca-btn-amber" disabled={loading} onClick={issueCertificate} type="button">{loading ? t(locale, "签发中...", "Issuing...") : t(locale, "确认签发", "Confirm & Issue")}</button></div>
        </Card>
      ) : (
        <Card>
          <div className="cpca-form-grid">
            <label><span>{t(locale, "证书模板", "Certificate Template")}</span><select>{activeTemplates.map((template) => <option key={template.id}>{localName(locale, template)}</option>)}</select></label>
            <label><span>{t(locale, "来源", "Source")}</span><select><option>Upload CSV</option><option>From Event Registration List</option><option>From Course Completion List</option><option>From LE Program Completion List</option></select></label>
            <label className="wide"><span>{t(locale, "选择活动 / 课程 / 项目", "Select Event / Course / Program")}</span><select><option>Shanghai Climate Week 2026</option><option>Youth Climate Action Forum</option></select></label>
          </div>
          <div className="cpca-table-wrap"><table className="cpca-table"><thead><tr><th><input defaultChecked type="checkbox" /></th><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{["Lin Wei", "Sarah Henderson", "Chen Yu", "Aiko Tanaka", "James O'Connor"].map((name, index) => <tr key={name}><td><input defaultChecked type="checkbox" /></td><td className="cpca-strong">{name}</td><td>recipient{index + 1}@example.com</td><td>{["Attendee", "Speaker", "Moderator", "Attendee", "Volunteer"][index]}</td><td><span className="cpca-badge cpca-badge-green">Ready</span></td></tr>)}</tbody></table></div>
          <div className="cpca-actions"><button className="cpca-btn cpca-btn-outline" type="button">{t(locale, "批量预览", "Preview Batch")}</button><button className="cpca-btn cpca-btn-amber" type="button">{t(locale, "签发选中 5 人", "Issue All Selected (5)")}</button></div>
        </Card>
      )}
      <Card title={t(locale, "最近签发记录", "Recent Issuances")}>
        <div className="cpca-table-wrap"><table className="cpca-table"><tbody>{(recentIssues.length ? recentIssues : fallbackIssues(locale)).slice(0, 5).map((issue) => <tr key={issue.id}><td className="cpca-strong">{issue.holderName}</td><td>{issue.certificateName}</td><td>{issue.issueDate}</td><td><StatusBadge status={issue.status}>{issue.status}</StatusBadge></td></tr>)}</tbody></table></div>
      </Card>
    </CertificateAdminFrame>
  );
}

export function CertificateAdminApplications({ locale, issues }: { locale: Locale; issues: CertificateAdminIssue[] }) {
  const rows = issues.length ? issues : fallbackIssues(locale);
  return (
    <CertificateAdminFrame locale={locale}>
      <PageHead title={t(locale, "证书申请审核", "Certificate Applications")} description={t(locale, "审核用户主动提交的证书、志愿服务、项目完成和活动参与证明申请。", "Review user-initiated certificate requests.")} />
      <div className="cpca-tab-row"><button className="cpca-btn cpca-btn-amber">All ({rows.length})</button><button className="cpca-btn cpca-btn-outline">Pending</button><button className="cpca-btn cpca-btn-outline">Approved</button><button className="cpca-btn cpca-btn-outline">Rejected</button><button className="cpca-btn cpca-btn-outline">Needs Info</button></div>
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
    <CertificateAdminFrame locale={locale}>
      <PageHead title={t(locale, "自动签发规则", "Automatic Issuing Rules")} description={t(locale, "配置课程、活动、Learning Experience、积分和人工审核触发条件。", "Configure trigger conditions for auto-issuing certificates.")} action={<button className="cpca-btn cpca-btn-amber" type="button">+ {t(locale, "创建规则", "Create Rule")}</button>} />
      <Card><div className="cpca-table-wrap"><table className="cpca-table"><thead><tr><th>{t(locale, "规则名称", "Rule Name")}</th><th>{t(locale, "触发", "Trigger")}</th><th>{t(locale, "条件", "Condition")}</th><th>{t(locale, "模板", "Template")}</th><th>{t(locale, "通知", "Notify")}</th><th>{t(locale, "确认", "Confirm")}</th><th>{t(locale, "状态", "Status")}</th><th>{t(locale, "操作", "Actions")}</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule[0]}><td className="cpca-strong">{rule[0]}</td><td>{rule[1]}</td><td>{rule[2]}</td><td>{templates[0] ? localName(locale, templates[0]) : rule[3]}</td><td><span className="cpca-badge cpca-badge-green">{rule[4]}</span></td><td><span className="cpca-badge cpca-badge-gray">{rule[5]}</span></td><td><StatusBadge status={rule[6]}>{rule[6]}</StatusBadge></td><td><button className="cpca-btn cpca-btn-ghost" type="button">{t(locale, "编辑", "Edit")}</button></td></tr>)}</tbody></table></div></Card>
      <Card title={t(locale, "创建签发规则", "Create Issuing Rule")}><div className="cpca-form-grid"><label><span>{t(locale, "规则名称", "Rule Name")}</span><input placeholder="Course Completion Auto-Issue" /></label><label><span>{t(locale, "触发来源", "Trigger Source")}</span><select><option>Course</option><option>Event</option><option>Learning Experience</option><option>Points</option><option>Manual Review</option></select></label><label className="wide"><span>{t(locale, "触发条件", "Trigger Condition")}</span><input placeholder="All modules complete, Points >= 1000" /></label><label><span>{t(locale, "证书模板", "Certificate Template")}</span><select>{templates.map((template) => <option key={template.id}>{localName(locale, template)}</option>)}</select></label><label><span>{t(locale, "签发时间", "Issue Timing")}</span><select><option>Immediate</option><option>Next Business Day</option><option>Manual Review</option></select></label></div><div className="cpca-toggle-row"><label><input defaultChecked type="checkbox" /> Admin Confirmation Required</label><label><input defaultChecked type="checkbox" /> Auto-notify User</label><label><input defaultChecked type="checkbox" /> Allow PDF Download</label><label><input type="checkbox" /> Public Display</label></div></Card>
    </CertificateAdminFrame>
  );
}

export function CertificateAdminRecords({ locale, issues }: { locale: Locale; issues: CertificateAdminIssue[] }) {
  const rows = issues.length ? issues : fallbackIssues(locale);
  const active = rows.filter((issue) => !issue.status.toLowerCase().includes("revoked")).length;
  const revoked = rows.filter((issue) => issue.status.toLowerCase().includes("revoked")).length;
  return (
    <CertificateAdminFrame locale={locale}>
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
  const rows = tab === "verify" ? (verifications.length ? verifications : fallbackLogs(locale)) : (auditLogs.length ? auditLogs : fallbackAdminLogs(locale));
  return (
    <CertificateAdminFrame locale={locale}>
      <PageHead title={t(locale, "验证与审计日志", "Verification & Audit Logs")} description={t(locale, "记录证书验证、下载、撤销、模板修改和批量签发等可信操作。", "Track credential verifications and administrative operations.")} />
      <div className="cpca-stats compact"><Metric label={t(locale, "今日验证", "Today's Verifications")} value={verifications.length} /><Metric label={t(locale, "成功率", "Success Rate")} value="94.2%" /><Metric label={t(locale, "异常", "Anomalies Detected")} value="2" /></div>
      <div className="cpca-tab-row"><button className={`cpca-btn ${tab === "verify" ? "cpca-btn-amber" : "cpca-btn-outline"}`} onClick={() => setTab("verify")} type="button">{t(locale, "验证日志", "Verification Log")}</button><button className={`cpca-btn ${tab === "admin" ? "cpca-btn-amber" : "cpca-btn-outline"}`} onClick={() => setTab("admin")} type="button">{t(locale, "后台操作", "Admin Operations")}</button></div>
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
  return names.map(([zh, en], index) => ({ id: `fallback-${index}`, key: en.toLowerCase().replaceAll(" ", "-"), name: zh, nameEn: en, isActive: index !== 9, templateCount: 10 - index, definitionCount: index + 1 }));
}

function fallbackTemplates(locale: Locale): CertificateAdminTemplate[] {
  return ["SHCW Official Certificate", "Course Completion - Standard", "Speaker Certificate - Premium", "Achievement Badge - Round", "Volunteer Service - Basic", "Digital Micro-Credential"].map((name, index) => ({ id: `fallback-template-${index}`, name, nameEn: name, templateType: index === 3 ? "ACHIEVEMENT" : index === 5 ? "CUSTOM" : "ATTENDANCE", isActive: index !== 5, version: 1, issuedCount: [2847, 1203, 428, 892, 471, 0][index] }));
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
