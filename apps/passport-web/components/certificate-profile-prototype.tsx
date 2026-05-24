"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/site-content";

function t(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

export type ProfileCredential = {
  id: string;
  name: string;
  category: string;
  type: string;
  issuedAt: string;
  verificationUrl?: string;
  isFeatured?: boolean;
};

export type ProfileData = {
  name: string;
  title?: string;
  passportId?: string;
  isVerified: boolean;
  credentials: ProfileCredential[];
  competencies?: { name: string; level: "advanced" | "intermediate" | "beginner" }[];
  timeline?: { date: string; title: string; type: string; verificationUrl?: string }[];
  programs?: { name: string; status: string; description?: string }[];
};

export function PublicProfilePage({
  locale,
  data,
}: {
  locale: Locale;
  data: ProfileData;
}) {
  const [activeTab, setActiveTab] = useState("all");

  const featured = data.credentials.filter((c) => c.isFeatured).slice(0, 3);
  const categories = Array.from(new Set(data.credentials.map((c) => c.category)));

  const filteredCredentials =
    activeTab === "all"
      ? data.credentials
      : data.credentials.filter((c) => c.category === activeTab || c.type.toLowerCase().includes(activeTab.toLowerCase()));

  return (
    <div className="cpp">
      {/* Profile Header */}
      <div className="cpp-header">
        <div className="cpp-header-bg" />
        <div className="cpp-header-content">
          <div className="cpp-avatar">
            <span>{data.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="cpp-header-info">
            <div className="cpp-name-row">
              <h1>{data.name}</h1>
              {data.isVerified && (
                <span className="cpp-verified-badge">
                  ✓ {t(locale, "已验证", "Verified")}
                </span>
              )}
            </div>
            <p className="cpp-title">{data.title ?? t(locale, "Climate Passport 认证持有人", "Verified Climate Passport Credential Holder")}</p>
            <div className="cpp-meta-items">
              {data.passportId && (
                <span className="cpp-meta-item">
                  🎫 Passport ID: {data.passportId}
                </span>
              )}
              <span className="cpp-meta-item">
                📅 {t(locale, "加入于", "Joined")} 2026
              </span>
            </div>
          </div>
          <div className="cpp-stats-row">
            <div className="cpp-stat">
              <strong>{data.credentials.length}</strong>
              <span>{t(locale, "证书", "Credentials")}</span>
            </div>
            <div className="cpp-stat">
              <strong>{categories.length}</strong>
              <span>{t(locale, "能力领域", "Competency Areas")}</span>
            </div>
            <div className="cpp-stat">
              <strong>{data.programs?.length ?? 0}</strong>
              <span>{t(locale, "参与项目", "Programs")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Credentials */}
      {featured.length > 0 && (
        <section className="cpp-section">
          <h2>{t(locale, "精选凭证", "Featured Credentials")}</h2>
          <div className="cpp-featured-grid">
            {featured.map((cred, index) => (
              <article className="cpp-featured-card" key={cred.id}>
                <div className={`cpp-card-accent accent-${index % 4}`} />
                <div className="cpp-card-top">
                  <span className="cpp-card-type">{cred.type}</span>
                  <span className="cpp-card-verified-icon">✓</span>
                </div>
                <h3>{cred.name}</h3>
                <p>{cred.category}</p>
                <span className="cpp-card-date">{cred.issuedAt}</span>
                {cred.verificationUrl && (
                  <Link className="cpp-card-verify-link" href={cred.verificationUrl}>
                    {t(locale, "验证", "Verify")} →
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Verified Competencies */}
      {data.competencies && data.competencies.length > 0 && (
        <section className="cpp-section">
          <h2>{t(locale, "已验证能力", "Verified Competencies")}</h2>
          <div className="cpp-competency-cloud">
            {data.competencies.map((comp) => (
              <span className={`cpp-skill-pill cpp-skill-${comp.level}`} key={comp.name}>
                {comp.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Climate Action Timeline */}
      {data.timeline && data.timeline.length > 0 && (
        <section className="cpp-section">
          <h2>{t(locale, "气候行动历程", "Climate Action Timeline")}</h2>
          <div className="cpp-timeline">
            {data.timeline.map((item, index) => (
              <div className="cpp-timeline-item" key={index}>
                <div className="cpp-timeline-dot" />
                <div className="cpp-timeline-content">
                  <span className="cpp-timeline-date">{item.date}</span>
                  <h4>{item.title}</h4>
                  <span className="cpp-timeline-type">{item.type}</span>
                  {item.verificationUrl && (
                    <Link className="cpp-timeline-verify" href={item.verificationUrl}>
                      {t(locale, "验证", "Verify")} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All Verified Credentials */}
      <section className="cpp-section">
        <h2>{t(locale, "全部已验证凭证", "All Verified Credentials")}</h2>
        <div className="cpp-tab-row">
          <button
            className={`cpp-tab ${activeTab === "all" ? "is-active" : ""}`}
            onClick={() => setActiveTab("all")}
            type="button"
          >
            {t(locale, "全部", "All")} ({data.credentials.length})
          </button>
          {categories.slice(0, 5).map((cat) => (
            <button
              className={`cpp-tab ${activeTab === cat ? "is-active" : ""}`}
              key={cat}
              onClick={() => setActiveTab(cat)}
              type="button"
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="cpp-credential-list">
          {filteredCredentials.map((cred) => (
            <div className="cpp-credential-row" key={cred.id}>
              <div className="cpp-credential-icon">📜</div>
              <div className="cpp-credential-info">
                <strong>{cred.name}</strong>
                <span>{cred.category}</span>
              </div>
              <div className="cpp-credential-date">{cred.issuedAt}</div>
              <span className="cpp-credential-type-badge">{cred.type}</span>
              {cred.verificationUrl && (
                <Link className="cpp-credential-verify" href={cred.verificationUrl}>
                  {t(locale, "验证", "Verify")}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Program Participation */}
      {data.programs && data.programs.length > 0 && (
        <section className="cpp-section">
          <h2>{t(locale, "项目参与", "Program Participation")}</h2>
          <div className="cpp-program-grid">
            {data.programs.map((program, index) => (
              <article className="cpp-program-card" key={index}>
                <h3>{program.name}</h3>
                <span className={`cpp-program-status ${program.status === "Completed" ? "is-complete" : "is-active"}`}>
                  {program.status}
                </span>
                {program.description && <p>{program.description}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
