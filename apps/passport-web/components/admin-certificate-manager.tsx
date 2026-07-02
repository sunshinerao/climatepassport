"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-content";

type CertCategory = {
  id: string;
  key: string;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  isActive: boolean;
  templateCount: number;
};

type CertTemplate = {
  id: string;
  name: string;
  nameEn?: string | null;
  templateType: string;
  isActive: boolean;
  version: number;
  categoryId: string;
};

type CertIssue = {
  id: string;
  status: string;
  user: { name: string; email: string };
  definition: { name: string };
  createdAt: string;
  issuedAt: string | null;
  verificationCode: string | null;
};

type AdminCertManagerProps = {
  locale: Locale;
  categories: CertCategory[];
  templates: CertTemplate[];
  recentIssues: CertIssue[];
};

type Tab = "categories" | "templates" | "issue";

export function AdminCertManager({ locale, categories, templates, recentIssues }: AdminCertManagerProps) {
  const isZh = locale === "zh";
  const [tab, setTab] = useState<Tab>("categories");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [issueEmail, setIssueEmail] = useState("");
  const [issueTemplateId, setIssueTemplateId] = useState("");
  const [issueMsg, setIssueMsg] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const categoryTemplates = templates.filter((t) => t.categoryId === selectedCategoryId);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  async function handleIssue() {
    if (!issueEmail || !issueTemplateId) {
      setIssueMsg(isZh ? "请填写收件人邮箱和证书模板。" : "Please fill in recipient email and template.");
      return;
    }
    setIssueLoading(true);
    setIssueMsg("");
    try {
      const res = await fetch("/api/admin/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: issueEmail, templateId: issueTemplateId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setIssueMsg(json.error ?? (isZh ? "颁发失败" : "Failed to issue certificate"));
      } else {
        setIssueMsg(isZh ? "✓ 证书已成功颁发！" : "✓ Certificate issued successfully!");
        setIssueEmail("");
      }
    } catch {
      setIssueMsg(isZh ? "网络错误" : "Network error");
    } finally {
      setIssueLoading(false);
    }
  }

  return (
    <>
      {/* ── Tabs ── */}
      <div className="cert-admin-tabs">
        <button
          className={`cert-admin-tab ${tab === "categories" ? "active" : ""}`}
          onClick={() => setTab("categories")}
          type="button"
        >
          {isZh ? "证书分类" : "Categories"}
        </button>
        <button
          className={`cert-admin-tab ${tab === "templates" ? "active" : ""}`}
          onClick={() => setTab("templates")}
          type="button"
        >
          {isZh ? "证书模版" : "Templates"}
        </button>
        <button
          className={`cert-admin-tab ${tab === "issue" ? "active" : ""}`}
          onClick={() => setTab("issue")}
          type="button"
        >
          {isZh ? "颁发证书" : "Issue Certificate"}
        </button>
      </div>

      {/* ── Categories tab ── */}
      {tab === "categories" && (
        <div className="cert-mgr-grid">
          <div>
            <span className="label" style={{ marginBottom: 12, display: "block" }}>
              {isZh ? `共 ${categories.length} 个分类` : `${categories.length} categories`}
            </span>
            <div className="cert-mgr-list">
              {categories.length === 0 ? (
                <p style={{ color: "var(--cp-text-muted)", fontSize: "var(--cp-fs-14)" }}>
                  {isZh ? "暂无证书分类数据" : "No categories found"}
                </p>
              ) : (
                categories.map((cat) => (
                  <button
                    className={`cert-mgr-item ${selectedCategoryId === cat.id ? "selected" : ""}`}
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
                    type="button"
                  >
                    <div className="cert-mgr-icon">📂</div>
                    <div className="cert-mgr-info">
                      <strong>{isZh ? cat.name : (cat.nameEn ?? cat.name)}</strong>
                      <span>{cat.templateCount} {isZh ? "个模版" : "templates"} · {cat.key}</span>
                    </div>
                    <span className={cat.isActive ? "badge-active" : "badge-inactive"}>
                      {cat.isActive ? (isZh ? "活跃" : "Active") : (isZh ? "停用" : "Inactive")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedCategory ? (
            <div className="cert-mgr-detail">
              <span className="label">{isZh ? "分类详情" : "Category detail"}</span>
              <h3 style={{ margin: "10px 0 6px" }}>{isZh ? selectedCategory.name : (selectedCategory.nameEn ?? selectedCategory.name)}</h3>
              <p style={{ color: "var(--cp-text-secondary)", fontSize: "var(--cp-fs-14)", margin: "0 0 18px" }}>
                {selectedCategory.description ?? (isZh ? "暂无描述" : "No description")}
              </p>
              <div className="cert-list">
                {categoryTemplates.length === 0 ? (
                  <p style={{ color: "var(--cp-text-muted)", fontSize: "var(--cp-fs-14)" }}>
                    {isZh ? "该分类暂无模版" : "No templates in this category"}
                  </p>
                ) : (
                  categoryTemplates.map((tpl) => (
                    <div className="cert-item" key={tpl.id}>
                      <div className="cert-mark">📋</div>
                      <div className="cert-info">
                        <strong>{isZh ? tpl.name : (tpl.nameEn ?? tpl.name)}</strong>
                        <div className="cert-issuer">{tpl.templateType} · v{tpl.version}</div>
                      </div>
                      <span className={tpl.isActive ? "badge-active" : "badge-inactive"}>
                        {tpl.isActive ? (isZh ? "活跃" : "Active") : (isZh ? "停用" : "Inactive")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="cert-mgr-detail" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
              <p style={{ color: "var(--cp-text-muted)", fontSize: "var(--cp-fs-14)" }}>
                {isZh ? "← 选择一个分类查看详情" : "← Select a category to view details"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Templates tab ── */}
      {tab === "templates" && (
        <div className="cert-mgr-grid">
          <div>
            <span className="label" style={{ marginBottom: 12, display: "block" }}>
              {isZh ? `共 ${templates.length} 个模版` : `${templates.length} templates`}
            </span>
            <div className="cert-mgr-list">
              {templates.length === 0 ? (
                <p style={{ color: "var(--cp-text-muted)", fontSize: "var(--cp-fs-14)" }}>
                  {isZh ? "暂无证书模版数据" : "No templates found"}
                </p>
              ) : (
                templates.map((tpl) => (
                  <button
                    className={`cert-mgr-item ${selectedTemplateId === tpl.id ? "selected" : ""}`}
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id === selectedTemplateId ? null : tpl.id)}
                    type="button"
                  >
                    <div className="cert-mgr-icon">📋</div>
                    <div className="cert-mgr-info">
                      <strong>{isZh ? tpl.name : (tpl.nameEn ?? tpl.name)}</strong>
                      <span>{tpl.templateType} · v{tpl.version}</span>
                    </div>
                    <span className={tpl.isActive ? "badge-active" : "badge-inactive"}>
                      {tpl.isActive ? (isZh ? "活跃" : "Active") : (isZh ? "停用" : "Inactive")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedTemplate ? (
            <div className="cert-mgr-detail">
              <span className="label">{isZh ? "模版详情" : "Template detail"}</span>
              <h3 style={{ margin: "10px 0 6px" }}>{isZh ? selectedTemplate.name : (selectedTemplate.nameEn ?? selectedTemplate.name)}</h3>
              <div className="tag-row" style={{ marginBottom: 16 }}>
                <span className="tag">{selectedTemplate.templateType}</span>
                <span className="tag">v{selectedTemplate.version}</span>
                <span className={selectedTemplate.isActive ? "badge-active" : "badge-inactive"}>
                  {selectedTemplate.isActive ? (isZh ? "活跃" : "Active") : (isZh ? "停用" : "Inactive")}
                </span>
              </div>
              <p style={{ color: "var(--cp-text-secondary)", fontSize: "var(--cp-fs-14)", margin: 0 }}>
                {isZh ? "关联分类：" : "Category: "}
                {categories.find((c) => c.id === selectedTemplate.categoryId)?.name ?? "—"}
              </p>
            </div>
          ) : (
            <div className="cert-mgr-detail" style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
              <p style={{ color: "var(--cp-text-muted)", fontSize: "var(--cp-fs-14)" }}>
                {isZh ? "← 选择一个模版查看详情" : "← Select a template to view details"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Issue certificate tab ── */}
      {tab === "issue" && (
        <div className="two-col" style={{ display: "grid", gap: 20 }}>
          {/* Issue form */}
          <div className="panel">
            <span className="label" style={{ marginBottom: 12, display: "block" }}>
              {isZh ? "手动颁发证书" : "Manually issue certificate"}
            </span>
            <div className="form-grid">
              <label className="field">
                <span>{isZh ? "收件人邮箱" : "Recipient email"}</span>
                <input
                  type="email"
                  value={issueEmail}
                  onChange={(e) => setIssueEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </label>
              <label className="field">
                <span>{isZh ? "证书模版" : "Certificate template"}</span>
                <select value={issueTemplateId} onChange={(e) => setIssueTemplateId(e.target.value)}>
                  <option value="">{isZh ? "请选择模版" : "Select template..."}</option>
                  {templates.filter((t) => t.isActive).map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {isZh ? tpl.name : (tpl.nameEn ?? tpl.name)}
                    </option>
                  ))}
                </select>
              </label>
              {issueMsg ? (
                <p className={issueMsg.startsWith("✓") ? "form-success" : "form-error"}>{issueMsg}</p>
              ) : null}
              <div className="button-row">
                <button
                  className="button"
                  disabled={issueLoading}
                  onClick={handleIssue}
                  type="button"
                >
                  {issueLoading ? (isZh ? "处理中…" : "Processing…") : (isZh ? "颁发证书" : "Issue Certificate")}
                </button>
              </div>
            </div>
          </div>

          {/* Recent issues */}
          <div className="panel">
            <span className="label" style={{ marginBottom: 12, display: "block" }}>
              {isZh ? "近期颁发记录" : "Recent issues"}
            </span>
            {recentIssues.length === 0 ? (
              <p style={{ color: "var(--cp-text-muted)", fontSize: "var(--cp-fs-14)", margin: 0 }}>
                {isZh ? "暂无颁发记录" : "No recent issues found"}
              </p>
            ) : (
              <div className="cert-list">
                {recentIssues.map((issue) => (
                  <div className="cert-item" key={issue.id}>
                    <div className="cert-mark">🏅</div>
                    <div className="cert-info">
                      <strong>{issue.definition.name}</strong>
                      <div className="cert-issuer">{issue.user.name} &lt;{issue.user.email}&gt;</div>
                      {issue.verificationCode ? (
                        <div className="cert-code">{issue.verificationCode}</div>
                      ) : null}
                    </div>
                    <span className="status-badge">{issue.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
