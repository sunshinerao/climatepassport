"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/site-content";

function t(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

export type UserCertificateCard = {
  id: string;
  name: string;
  category: string;
  type: string;
  status: string;
  statusLabel: string;
  certificateNumber: string;
  issuedAtLabel: string;
  verificationCount: number;
  downloadCount: number;
  templateName?: string | null;
  issuer?: string;
  expiryDate?: string;
  relatedSource?: string;
  competencies?: string[];
  verificationUrl?: string;
};

export function CertificatePortfolioPage({
  locale,
  cards,
  categories,
}: {
  locale: Locale;
  cards: UserCertificateCard[];
  categories: string[];
}) {
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedCard, setSelectedCard] = useState<UserCertificateCard | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const issuedCount = cards.filter((c) => c.status === "ISSUED").length;
  const verifiedCount = cards.filter((c) => c.verificationCount > 0).length;
  const totalVerifications = cards.reduce((sum, c) => sum + c.verificationCount, 0);

  const filteredCards = cards.filter((card) => {
    const matchesFilter =
      activeFilter === "all" ||
      card.status.toLowerCase() === activeFilter.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      [card.name, card.category, card.certificateNumber, card.type]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  function openDetail(card: UserCertificateCard) {
    setSelectedCard(card);
    setView("detail");
  }

  function backToList() {
    setView("list");
    setSelectedCard(null);
  }

  if (view === "detail" && selectedCard) {
    return (
      <div className="cpu">
        <button className="cpu-back-btn" onClick={backToList} type="button">
          ← {t(locale, "返回证书列表", "Back to certificates")}
        </button>

        <div className="cpu-detail-layout">
          {/* Certificate Preview */}
          <div className="cpu-preview-panel">
            <div className="cpu-preview-frame">
              <div className="cpu-preview-watermark">Climate Passport</div>
              <div className="cpu-preview-header">
                <span className="cpu-preview-issuer">{selectedCard.issuer ?? "Climate Passport"}</span>
                <h2>{selectedCard.name}</h2>
                <p className="cpu-preview-subtitle">{selectedCard.category}</p>
              </div>
              <div className="cpu-preview-body">
                <p>{t(locale, "特此证明", "This is to certify that")}</p>
                <div className="cpu-preview-holder">{t(locale, "[持有人姓名]", "[Holder Name]")}</div>
                <p>
                  {t(
                    locale,
                    "已完成相关要求并获得此证书",
                    "has fulfilled the requirements and is awarded this certificate"
                  )}
                </p>
              </div>
              <div className="cpu-preview-footer">
                <div className="cpu-preview-signatures">
                  <div>
                    <div className="cpu-preview-sig-line" />
                    <span>{t(locale, "签发人", "Issued By")}</span>
                  </div>
                  <div>
                    <div className="cpu-preview-sig-line" />
                    <span>{t(locale, "日期", "Date")}: {selectedCard.issuedAtLabel}</span>
                  </div>
                </div>
                <div className="cpu-preview-qr">
                  <div className="cpu-qr-placeholder" />
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Panel */}
          <div className="cpu-meta-panel">
            <div className="cpu-meta-section">
              <h3>{t(locale, "证书信息", "Certificate Information")}</h3>
              <dl className="cpu-meta-grid">
                <div>
                  <dt>{t(locale, "证书名称", "Certificate Name")}</dt>
                  <dd>{selectedCard.name}</dd>
                </div>
                <div>
                  <dt>{t(locale, "证书类型", "Certificate Type")}</dt>
                  <dd>{selectedCard.type}</dd>
                </div>
                <div>
                  <dt>{t(locale, "分类", "Category")}</dt>
                  <dd>{selectedCard.category}</dd>
                </div>
                <div>
                  <dt>{t(locale, "证书编号", "Certificate No.")}</dt>
                  <dd className="cpu-mono">{selectedCard.certificateNumber}</dd>
                </div>
                <div>
                  <dt>{t(locale, "签发日期", "Issue Date")}</dt>
                  <dd>{selectedCard.issuedAtLabel}</dd>
                </div>
                <div>
                  <dt>{t(locale, "状态", "Status")}</dt>
                  <dd>
                    <span className={`cpu-status-pill ${selectedCard.status === "ISSUED" ? "is-valid" : "is-pending"}`}>
                      {selectedCard.statusLabel}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>{t(locale, "验证次数", "Verifications")}</dt>
                  <dd>{selectedCard.verificationCount}</dd>
                </div>
                <div>
                  <dt>{t(locale, "下载次数", "Downloads")}</dt>
                  <dd>{selectedCard.downloadCount}</dd>
                </div>
              </dl>
            </div>

            {/* Competency Tags */}
            {selectedCard.competencies && selectedCard.competencies.length > 0 && (
              <div className="cpu-meta-section">
                <h3>{t(locale, "能力标签", "Competency Tags")}</h3>
                <div className="cpu-tags">
                  {selectedCard.competencies.map((tag) => (
                    <span className="cpu-tag" key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="cpu-meta-section">
              <h3>{t(locale, "操作", "Actions")}</h3>
              <div className="cpu-action-buttons">
                <button className="cpu-btn cpu-btn-primary" type="button">
                  {t(locale, "下载 PDF", "Download PDF")}
                </button>
                <button className="cpu-btn cpu-btn-outline" type="button">
                  {t(locale, "复制验证链接", "Copy Verification Link")}
                </button>
              </div>
              <div className="cpu-share-row">
                <span>{t(locale, "分享至", "Share to")}:</span>
                <button className="cpu-share-btn" type="button">LinkedIn</button>
                <button className="cpu-share-btn" type="button">WeChat</button>
                <button className="cpu-share-btn" type="button">Email</button>
              </div>
            </div>

            {/* Verification URL */}
            {selectedCard.verificationUrl && (
              <div className="cpu-meta-section cpu-verify-section">
                <h3>{t(locale, "公开验证", "Public Verification")}</h3>
                <div className="cpu-verify-url-box">
                  <code>{selectedCard.verificationUrl}</code>
                </div>
                <div className="cpu-toggle-row">
                  <label>
                    <span>{t(locale, "在公开档案中展示", "Show in public profile")}</span>
                    <input defaultChecked type="checkbox" className="cpu-toggle" />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cpu">
      {/* Hero Banner */}
      <div className="cpu-hero">
        <div className="cpu-hero-content">
          <h1>{t(locale, "我的证书组合", "My Certificate Portfolio")}</h1>
          <p>
            {t(
              locale,
              "管理你的可信数字证书、徽章与能力记录",
              "Manage your trusted digital certificates, badges, and capability records"
            )}
          </p>
          <div className="cpu-hero-stats">
            <div className="cpu-hero-stat">
              <strong>{cards.length}</strong>
              <span>{t(locale, "证书总数", "Total Certificates")}</span>
            </div>
            <div className="cpu-hero-stat">
              <strong>{issuedCount}</strong>
              <span>{t(locale, "已签发", "Issued")}</span>
            </div>
            <div className="cpu-hero-stat">
              <strong>{verifiedCount}</strong>
              <span>{t(locale, "已验证", "Verified")}</span>
            </div>
            <div className="cpu-hero-stat">
              <strong>{totalVerifications}</strong>
              <span>{t(locale, "总验证次数", "Total Verifications")}</span>
            </div>
          </div>
          <div className="cpu-hero-progress">
            <div className="cpu-progress-bar">
              <div className="cpu-progress-fill" style={{ width: `${cards.length > 0 ? Math.min(100, (issuedCount / cards.length) * 100) : 0}%` }} />
            </div>
            <span>{issuedCount}/{cards.length} {t(locale, "已签发", "issued")}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="cpu-filter-bar">
        <div className="cpu-search-wrapper">
          <span className="cpu-search-icon">⌕</span>
          <input
            className="cpu-search-input"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(locale, "搜索证书名称、编号...", "Search by name, number...")}
            type="search"
            value={searchQuery}
          />
        </div>
        <div className="cpu-filter-pills">
          {[
            { key: "all", label: t(locale, "全部", "All") },
            { key: "ISSUED", label: t(locale, "已签发", "Issued") },
            { key: "PENDING", label: t(locale, "待审核", "Pending") },
            { key: "EXPIRED", label: t(locale, "已过期", "Expired") },
            { key: "REVOKED", label: t(locale, "已撤销", "Revoked") },
          ].map((filter) => (
            <button
              className={`cpu-filter-pill ${activeFilter === filter.key ? "is-active" : ""}`}
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Certificate Card Grid */}
      {filteredCards.length === 0 ? (
        <div className="cpu-empty">
          <p>
            {searchQuery || activeFilter !== "all"
              ? t(locale, "没有符合筛选条件的证书", "No certificates match your filters")
              : t(locale, "暂无证书记录。完成课程、活动或项目后将自动获得证书。", "No certificates yet. Complete courses, events, or programs to earn certificates.")}
          </p>
        </div>
      ) : (
        <div className="cpu-card-grid">
          {filteredCards.map((card, index) => (
            <article
              className="cpu-card"
              key={card.id}
              onClick={() => openDetail(card)}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className={`cpu-card-accent accent-${index % 6}`} />
              <div className="cpu-card-top">
                <span className="cpu-card-type">{card.type}</span>
                {card.status === "ISSUED" && <span className="cpu-card-verified">✓</span>}
              </div>
              <h3>{card.name}</h3>
              <p className="cpu-card-org">{card.issuer ?? "Climate Passport"}</p>
              <div className="cpu-card-meta">
                <span>{card.issuedAtLabel}</span>
                <span className={`cpu-card-status ${card.status === "ISSUED" ? "is-valid" : card.status === "REVOKED" ? "is-revoked" : "is-pending"}`}>
                  <span className="cpu-dot" />
                  {card.statusLabel}
                </span>
              </div>
              <button className="cpu-card-view-btn" type="button">
                {t(locale, "查看详情", "View Details")} →
              </button>
            </article>
          ))}
        </div>
      )}

      {/* Load More (placeholder) */}
      {filteredCards.length > 9 && (
        <div className="cpu-load-more">
          <button className="cpu-btn cpu-btn-outline" type="button">
            {t(locale, "加载更多", "Load More")}
          </button>
        </div>
      )}
    </div>
  );
}
