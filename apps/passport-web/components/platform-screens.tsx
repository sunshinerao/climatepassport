import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { ContactMessageForm } from "@/components/contact-message-form";
import { NotificationPreferencesForm } from "@/components/notification-preferences-form";
import { EventsFilterableGrid } from "@/components/events-filterable-grid";
import { sanitizeLocalRedirectPath } from "@/lib/redirect-path";
import type { Locale } from "@/lib/site-content";
import { getCurrentUser, getDashboardPathForRole, requireAuthenticatedUser } from "@/lib/server/auth";
import {
  getCertificatesPageData,
  getEventsPageData,
  getHomePageData,
  getInfoPageData,
  getLoginPageData,
  getMessagesPageData,
  getNotificationsPageData,
  getPassportPageData,
  getRegisterPageData,
  getSpeakersPageData,
} from "@/lib/server/platform-data";

function formatEventDateBadge(date: Date | null, locale: Locale) {
  if (!date) return { day: "--", month: "--" };
  const d = new Date(date);
  const day = d.getDate();
  const month = locale === "zh"
    ? `${d.getMonth() + 1}月`
    : d.toLocaleDateString("en-US", { month: "short" });
  return { day: String(day), month };
}

export async function HomeScreen({ locale }: { locale: Locale }) {
  const { home, upcomingEvents } = await getHomePageData(locale);
  const isZh = locale === "zh";
  const climateEraTip = "“气候时代”并非一个单一机构正式定义的法律或科学术语，而是基于联合国、IPCC、UNFCCC等国际权威语境形成的传播表达。它指的是气候变化、能源转型、可持续发展和绿色经济正在深刻影响个人能力、产业结构、城市治理与全球合作的新阶段。";
  const climateEraTipGlobal = "\"Climate era\" is not a formal legal or scientific term defined by one institution. It is a communication expression formed in the context of UN, IPCC, UNFCCC, and other international authorities, describing a new stage where climate change, energy transition, sustainable development, and green economy are reshaping individual capabilities, industry structures, urban governance, and global collaboration.";
  const climatePassportTipByLocale: Record<Locale, string> = {
    zh: "在气候变化重塑世界的今天，每一次学习、参与和行动，都可能成为面向未来的重要能力与可信记录。Climate Passport 帮助你建立一份属于自己的可信数字档案。Climate Passport is an AI-driven digital identity infrastructure for the climate era.",
    en: "As climate change reshapes the world, every learning step, participation, and action can become future-facing capability and a trusted record. Climate Passport helps you build a trusted digital profile that belongs to you. Climate Passport is an AI-driven digital identity infrastructure for the climate era.",
    fr: "Alors que le changement climatique transforme le monde, chaque apprentissage, participation et action peut devenir une capacite pour l'avenir et un enregistrement fiable. Climate Passport vous aide a construire un profil numerique de confiance qui vous appartient. Climate Passport is an AI-driven digital identity infrastructure for the climate era.",
    de: "Da der Klimawandel die Welt neu formt, kann jeder Lernschritt, jede Teilnahme und jede Handlung zu einer zukunftsorientierten Fahigkeit und zu einem vertrauenswurdigen Nachweis werden. Climate Passport hilft Ihnen, ein vertrauenswurdiges digitales Profil aufzubauen, das Ihnen gehort. Climate Passport is an AI-driven digital identity infrastructure for the climate era.",
  };
  const heroSubtitleByLocale: Record<Locale, { line1: string; line2: string }> = {
    zh: {
      line1: "为地球留下行动，为自己积累价值，为未来建立信任",
      line2: "你为未来做过的事，都值得被看见",
    },
    en: {
      line1: "Leave action for the planet, build value for yourself, and create trust for the future",
      line2: "Everything you have done for the future deserves to be seen",
    },
    fr: {
      line1: "Laisser des actions pour la planete, accumuler de la valeur pour soi, et construire la confiance pour l'avenir",
      line2: "Tout ce que vous avez fait pour l'avenir merite d'etre vu",
    },
    de: {
      line1: "Handlungen fur den Planeten hinterlassen, fur sich selbst Wert aufbauen und Vertrauen fur die Zukunft schaffen",
      line2: "Alles, was Sie fur die Zukunft getan haben, verdient es, gesehen zu werden",
    },
  };
  const heroDescByLocale: Record<Locale, string> = {
    zh: "Climate Passport 将你的学习、参与、证书与气候行动，转化为一份由你拥有、可验证、可分享的可信数字档案。让每一次努力被看见，让每一次行动成为未来的价值。",
    en: "Climate Passport transforms your learning, participation, certificates, and climate action into a trusted digital profile that you own, can verify, and can share. Let every effort be seen, and let every action become value for the future.",
    fr: "Climate Passport transforme vos apprentissages, votre participation, vos certificats et vos actions climatiques en un dossier numerique fiable que vous possedez, pouvez verifier et partager. Que chaque effort soit vu, et que chaque action devienne une valeur pour l'avenir.",
    de: "Climate Passport verwandelt Ihr Lernen, Ihre Teilnahme, Ihre Zertifikate und Ihre Klimaaktionen in ein vertrauenswurdiges digitales Profil, das Ihnen gehort, verifizierbar und teilbar ist. Jede Anstrengung soll sichtbar werden, und jede Aktion soll zu einem Wert fur die Zukunft werden.",
  };
  const heroMediaFrames = [
    {
      src: "/hero-loop-identity.svg",
      alt: isZh ? "气候身份档案展示" : "Climate identity profile showcase",
      label: isZh ? "身份档案" : "Identity",
    },
    {
      src: "/hero-loop-events.svg",
      alt: isZh ? "活动与参与记录展示" : "Events and participation records showcase",
      label: isZh ? "活动记录" : "Events",
    },
    {
      src: "/hero-loop-certificates.svg",
      alt: isZh ? "证书与里程碑展示" : "Certificates and milestones showcase",
      label: isZh ? "证书里程碑" : "Certificates",
    },
  ];

  const heroTermByLocale: Record<Locale, string> = {
    zh: "气候时代",
    en: "climate era",
    fr: "ere climatique",
    de: "Klima-Zeitalter",
  };
  const heroTerm = heroTermByLocale[locale];
  const normalizedTitle = home.title.toLowerCase();
  const normalizedHeroTerm = heroTerm.toLowerCase();
  const heroTermIndex = normalizedTitle.indexOf(normalizedHeroTerm);
  const hasHeroTerm = heroTermIndex >= 0;
  const heroTermTip = isZh ? climateEraTip : climateEraTipGlobal;
  const climatePassportTip = climatePassportTipByLocale[locale];

  return (
    <div className="proto-home">
      {/* Hero */}
      <section className="proto-home-hero">
        <svg className="hero-leaf-deco one" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 10 C30 30, 10 50, 50 90 C70 70, 90 50, 50 10Z"/>
        </svg>
        <svg className="hero-leaf-deco two" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 10 C30 30, 10 50, 50 90 C70 70, 90 50, 50 10Z"/>
        </svg>

        <div className="proto-home-inner proto-home-hero-inner">
          <div className="hero-content">
            <div className="hero-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>{isZh ? "超过10,000名气候先锋信赖" : "Trusted by 10,000+ climate champions"}</span>
            </div>
            <h1 className={isZh ? "proto-title proto-title-hero-unified proto-title-zh-single-line" : "proto-title proto-title-hero-unified"}>
              {isZh ? (
                <>
                  为
                  <span className="hero-term-with-tip">
                    <span className="hero-term-text">气候时代</span>
                    <span className="hero-term-tooltip" role="tooltip">{climateEraTip}</span>
                  </span>
                  构建可信数字身份基础设施。
                </>
              ) : hasHeroTerm ? (
                <>
                  {home.title.slice(0, heroTermIndex)}
                  <span className="hero-term-with-tip">
                    <span className="hero-term-text">{home.title.slice(heroTermIndex, heroTermIndex + heroTerm.length)}</span>
                    <span className="hero-term-tooltip" role="tooltip">{heroTermTip}</span>
                  </span>
                  {home.title.slice(heroTermIndex + heroTerm.length)}
                </>
              ) : (
                home.title
              )}
            </h1>
            <p className="hero-subtitle">
              {heroSubtitleByLocale[locale].line1}
              <br />
              {heroSubtitleByLocale[locale].line2}
            </p>
            <p className="hero-desc">
              <span className="hero-brand-with-tip">
                <span className="hero-brand-text">Climate Passport</span>
                <span className="hero-brand-tooltip" role="tooltip">{climatePassportTip}</span>
              </span>
              {" "}
              {heroDescByLocale[locale].replace(/^Climate Passport\s*/, "")}
            </p>
            <div className="hero-ctas">
              <Link className="button button-amber" href={`/${locale}/auth/register`}>
                {isZh ? "获取护照" : "Get Your Passport"}
              </Link>
              <Link className="button-outline" href={`/${locale}/events`}>
                {isZh ? "探索活动" : "Explore Events"}
              </Link>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-media-loop" aria-label={isZh ? "Climate Passport 自动轮播展示" : "Climate Passport auto-loop showcase"}>
              {heroMediaFrames.map((frame, index) => (
                <figure
                  key={frame.src}
                  className={`hero-media-slide hero-media-slide-${index + 1}`}
                  aria-hidden={index > 0}
                >
                  <img src={frame.src} alt={frame.alt} loading="eager" />
                  <figcaption>{frame.label}</figcaption>
                </figure>
              ))}
              <div className="hero-media-progress" aria-hidden="true">
                <span />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="proto-stats-strip">
        <div className="proto-home-inner proto-stats-inner">
          {home.metrics.map((metric) => (
            <div className="stat-item" key={metric.label}>
              <div className="stat-value">{metric.value}</div>
              <div className="stat-label">{metric.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="proto-section how-it-works">
        <div className="proto-home-inner">
          <header className="section-header">
            <span className="section-label">{isZh ? "使用方式" : "How It Works"}</span>
            <h2 className="section-title">
              {isZh ? (
                <>
                  三步开启你的
                  <span className="section-title-en">Climate Passport</span>
                </>
              ) : (
                <>
                  Three Steps to Launch Your
                  <span className="section-title-en">Climate Passport</span>
                </>
              )}
            </h2>
            <p className="section-desc">{isZh ? "几分钟内开始，成为有意义的行动的一部分" : "Get started in minutes and become part of a movement that matters."}</p>
          </header>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>{isZh ? "创建档案" : "Create Your Profile"}</h3>
              <p>{isZh ? "免费注册并获取全球唯一的 Climate Passport ID。建立包含你目标与背景的个人气候身份。" : "Register for free and claim your globally unique Climate Passport ID. Build your personal climate identity with your goals and background."}</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>{isZh ? "参与并持续学习" : "Join, Participate & Learn"}</h3>
              <p>{isZh ? "参与全球峰会、工作坊与学习项目。你的记录会在每一次参与中自动累积。" : "Attend summits, workshops and learning programs around the world. Records accumulate automatically as you participate."}</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>{isZh ? "获取与分享" : "Earn & Share"}</h3>
              <p>{isZh ? "获取可验证证书、成就与积分。与你的社区随时随地分享气候旅程。" : "Receive verifiable certificates, achievements and points. Share your climate journey with the community, anywhere and anytime."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Events */}
      {upcomingEvents.length > 0 && (
        <section className="proto-section events">
          <div className="proto-home-inner">
            <header className="section-header">
              <span className="section-label">{isZh ? "近期活动" : "Upcoming Events"}</span>
              <h2 className="section-title">{isZh ? "探索未来" : "Discover What's Next"}</h2>
              <p className="section-desc">{isZh ? "与专家、创新者和变革者建立联系。" : "Connect with experts, innovators, and changemakers."}</p>
            </header>
            <div className="event-cards">
              {upcomingEvents.map((event) => {
                const badge = formatEventDateBadge(event.startDate, locale);
                return (
                  <div className="event-card" key={event.id}>
                    <div className="event-image">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <div className="event-date-badge">
                        <span className="day">{badge.day}</span>
                        <span className="month">{badge.month}</span>
                      </div>
                    </div>
                    <div className="event-content">
                      <h3>{event.title}</h3>
                      <div className="event-location">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>{event.venue || (isZh ? "线上活动" : "Virtual Event")}</span>
                      </div>
                      <Link className="button-outline event-btn" href={`/${locale}/events`}>
                        {isZh ? "了解更多" : "Learn More"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="proto-section features">
        <div className="proto-home-inner">
          <header className="section-header">
            <span className="section-label">{isZh ? "功能" : "Features"}</span>
            <h2 className="section-title">{isZh ? "您所需的一切" : "Everything You Need"}</h2>
              <p className="section-desc">{isZh ? "赋能你的气候行动与成长。" : "A climate action and growth ecosystem."}</p>
          </header>
          <div className="feature-cards">
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>{isZh ? "数字身份" : "Digital Identity"}</h3>
              <p>{isZh ? "一个您拥有的统一可携带气候档案。将活动、学习和证书链接为可信赖的行动档案，随处分享。" : "A unified and portable climate profile you own. Connect events, learning, and certificates into a trusted action record you can share anywhere."}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5 1.34 3.5 3 3.5z"/>
                  <path d="M8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11z"/>
                  <path d="M2 20c0-2.8 2.24-5 5-5h2"/>
                  <path d="M13 20c0-2.8 2.24-5 5-5h2"/>
                </svg>
              </div>
              <h3>{isZh ? "活动网络" : "Activity Network"}</h3>
              <p>{isZh ? "涵盖峰会、工作坊、展览和线上项目。无缝注册、数字签到及个性化推荐。" : "Access summits, workshops, exhibitions, and online programs with seamless registration, digital check-ins, and personalized recommendations."}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="7"/>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                </svg>
              </div>
              <h3>{isZh ? "可信证书" : "Trusted Certificates"}</h3>
              <p>{isZh ? "与个人成长路径关联的可验证证书。可分享、区块链支持，受全球雇主信赖。" : "Verifiable certificates connected to your growth path. Shareable, blockchain-backed, and trusted by employers worldwide."}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <h3>{isZh ? "学习体验" : "Learning Experience"}</h3>
              <p>{isZh ? "面向实践气候行动能力的项目式学习。学习记录随成长自动积累。" : "Project-based learning focused on practical climate action capability. Learning records accumulate automatically as you grow."}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <h3>{isZh ? "智能签到" : "Smart Check-in"}</h3>
              <p>{isZh ? "基于二维码的出席验证和实时参与追踪。出席记录构建您的气候行动历史。" : "QR-based attendance verification and real-time participation tracking. Attendance records build your climate action history."}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <h3>{isZh ? "影响力追踪" : "Impact Tracking"}</h3>
              <p>{isZh ? "获取积分、追踪成就并衡量您的气候贡献。一份不断增长的经过验证的行动组合。" : "Earn points, track achievements, and measure your climate contribution in a continuously growing, verifiable action portfolio."}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export async function ClimatePassportScreen({ locale }: { locale: Locale }) {
  noStore();
  await requireAuthenticatedUser(locale, `/${locale}/dashboard/climate-passport`);
  const { passport, account } = await getPassportPageData(locale);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{passport.label}</span>
          <h1>{passport.title}</h1>
        </div>
        <p>{passport.intro}</p>
      </div>

      <section className="passport-card">
        <div className="passport-top">
          <div>
            <span className="hero-kicker">{passport.authority}</span>
            <h2>Climate Passport</h2>
            <p className="passport-meta">{passport.authorityBody}</p>
          </div>
          <span className="chip">{passport.activeBadge}</span>
        </div>

        <div className="passport-layout">
          <div>
            <div className="passport-profile">
              <div className="avatar">{account.name.charAt(0)}</div>
              <div>
                <div className="passport-number">{account.climatePassportId}</div>
                <div className="passport-meta">{account.name}</div>
                <div className="passport-meta">{account.role}</div>
              </div>
            </div>

            <div className="passport-stats">
              <div className="passport-stat">
                <span className="label">{passport.points}</span>
                <strong>{account.points}</strong>
              </div>
              <div className="passport-stat">
                <span className="label">{passport.attended}</span>
                <strong>{account.attended}</strong>
              </div>
              <div className="passport-stat">
                <span className="label">{passport.hours}</span>
                <strong>{account.learningHours}</strong>
              </div>
            </div>

            <div className="button-row">
              <span className="chip">{passport.issued} {account.issuedAt}</span>
              <span className="chip">{account.achievements} {passport.achievements}</span>
            </div>
          </div>

          <aside className="qr-card">
            <span className="label">{passport.qrLabel}</span>
            <h3>{passport.qrTitle}</h3>
            <div className="qr-box">
              <div className="qr-pattern" aria-label="Passport QR pattern" />
            </div>
            <p className="footer-note">{passport.qrNote}</p>
          </aside>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <span className="label">{passport.archiveLabel}</span>
            <h2>{passport.archiveTitle}</h2>
          </div>
        </div>

        <div className="badge-grid">
          {passport.achievementsList.map((item) => (
            <div className={`badge-tile ${item.unlocked ? "earned" : "locked"}`} key={item.title}>
              <span className="badge-icon">{item.unlocked ? "✦" : "○"}</span>
              <strong className="badge-name">{item.title}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export async function CertificatesScreen({ locale }: { locale: Locale }) {
  const { certificates } = await getCertificatesPageData(locale);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{certificates.label}</span>
          <h1>{certificates.title}</h1>
        </div>
        <p>{certificates.intro}</p>
      </div>

      <section className="section">
        <div className="section-header">
          <div>
            <span className="label">{certificates.familyLabel}</span>
            <h2>{certificates.familyTitle}</h2>
          </div>
        </div>

        <div className="certificate-grid">
          {certificates.categories.map((category) => (
            <article className="data-card" key={category.name}>
              <span className="status-badge">{category.status}</span>
              <h3>{category.name}</h3>
              <p>{category.rule}</p>
              <div className="footer-note">{category.templates} active templates</div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <span className="label">{certificates.generationLabel}</span>
            <h2>{certificates.generationTitle}</h2>
          </div>
        </div>

        <div className="cert-list">
          {certificates.queue.map((item) => (
            <div className="cert-item" key={`${item.recipient}-${item.definition}`}>
              <div className="cert-mark">🏅</div>
              <div className="cert-info">
                <strong>{item.definition}</strong>
                <div className="cert-issuer">{item.recipient}</div>
                <div className="cert-code">{item.linkedOutcome}</div>
              </div>
              <span className="status-badge">{item.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <span className="label">{certificates.verificationLabel}</span>
            <h2>{certificates.verificationTitle}</h2>
          </div>
        </div>

        <div className="cert-list">
          {certificates.checks.map((check) => (
            <div className="cert-item" key={check.code}>
              <div className="cert-mark">✓</div>
              <div className="cert-info">
                <strong>{check.result}</strong>
                <div className="cert-code">{check.code}</div>
                <div className="cert-issuer">{check.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="footer-note">{certificates.verificationNote}</p>
      </section>
    </>
  );
}

export async function EventsScreen({ locale }: { locale: Locale }) {
  const { events } = await getEventsPageData(locale);
  const isZh = locale === "zh";

  return (
    <>
      <section className="proto-events-head">
        <div className="eyebrow">{events.label}</div>
        <h1>{events.title}</h1>
        <p>{events.intro}</p>
        <div className="proto-events-search" role="search">
          <input type="search" placeholder={isZh ? "搜索活动、关键字、地点…" : "Search events, keywords, venues…"} aria-label={isZh ? "搜索活动" : "Search events"} />
        </div>
      </section>

      <EventsFilterableGrid
        locale={locale}
        cards={events.cards.map((event) => ({
          title: event.title,
          status: event.status,
          window: event.window,
          venue: event.venue,
          category: (event as { category?: string | null }).category ?? null,
        }))}
      />

      <section className="section">
        <div className="section-header">
          <div>
            <span className="label">{events.agendaLabel}</span>
            <h2>{events.agendaTitle}</h2>
          </div>
        </div>
        <div className="activity-list">
          {events.agenda.map((item) => (
            <div className="activity-entry" key={`${item.time}-${item.title}`}>
              <div className="activity-pin" />
              <div className="activity-body">
                <strong>{item.title}</strong>
                <span className="activity-time">{item.time}</span>
                <p>{item.detail}</p>
                <div className="footer-note">{item.speakers}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section proto-events-past">
        <div className="section-header">
          <div>
            <span className="label">{isZh ? "往期回顾" : "Past events"}</span>
            <h2>{isZh ? "部分往期活动可回看" : "Replays from past programmes"}</h2>
          </div>
          <Link className="button-outline" href={`/${locale}/certificates`}>
            {isZh ? "查看往期证书" : "View past certificates"}
          </Link>
        </div>
        <div className="proto-events-past-list">
          {events.cards.slice(0, 3).map((event) => (
            <article key={`past-${event.title}`}>
              <div className="proto-events-past-thumb" aria-hidden="true" />
              <div>
                <strong>{event.title}</strong>
                <p>{event.window} · {event.venue}</p>
              </div>
              <span className="status-badge">{isZh ? "查看回放" : "View recording"}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export async function SpeakersScreen({ locale }: { locale: Locale }) {
  const { speakers } = await getSpeakersPageData(locale);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{speakers.label}</span>
          <h1>{speakers.title}</h1>
        </div>
        <p>{speakers.intro}</p>
      </div>

      <section className="section">
        <span className="label">{speakers.featuredLabel}</span>
        <div className="person-grid">
          {speakers.cards.map((speaker) => (
            <article className="person-card" key={speaker.name}>
              <div className="person-top">
                <div className="person-avatar">{speaker.name.charAt(0)}</div>
                <div className="person-info">
                  <strong>{speaker.name}</strong>
                  <div className="person-title">{speaker.role}</div>
                  <div className="person-org">{speaker.organization}</div>
                </div>
              </div>
              {speaker.tags.length > 0 ? (
                <div className="tag-row">
                  {speaker.tags.map((tag) => (
                    <span className="tag" key={`${speaker.name}-${tag}`}>{tag}</span>
                  ))}
                </div>
              ) : null}
              <div className="button-row">
                <span className="status-badge">{speaker.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export async function NotificationsScreen({ locale }: { locale: Locale }) {
  noStore();
  await requireAuthenticatedUser(locale, `/${locale}/dashboard/notifications`);
  const { notifications } = await getNotificationsPageData(locale);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{notifications.label}</span>
          <h1>{notifications.title}</h1>
        </div>
        <p>{notifications.intro}</p>
      </div>

      <section className="section two-col">
        <div className="panel">
          <span className="label">{notifications.channelsLabel}</span>
          <h3>{notifications.channelsTitle}</h3>
          <NotificationPreferencesForm channels={notifications.channels} locale={locale} />
          <div className="list">
            {notifications.channels.map((channel) => (
              <div className="list-item" key={channel.title}>
                <span className="label">{channel.status}</span>
                <strong>{channel.title}</strong>
                <p>{channel.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <span className="label">{notifications.feedLabel}</span>
          <h3>{notifications.feedTitle}</h3>
          <div className="list">
            {notifications.items.map((item) => (
              <div className="list-item" key={`${item.title}-${item.status}`}>
                <span className="label">{item.status}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export async function MessagesScreen({ locale }: { locale: Locale }) {
  noStore();
  await requireAuthenticatedUser(locale, `/${locale}/dashboard/messages`);
  const { messages } = await getMessagesPageData(locale);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{messages.label}</span>
          <h1>{messages.title}</h1>
        </div>
        <p>{messages.intro}</p>
      </div>

      <section className="section two-col">
        <div className="panel">
          <span className="label">{messages.inboxLabel}</span>
          <h3>{messages.inboxTitle}</h3>
          <ContactMessageForm locale={locale} />
          <div className="list">
            {messages.threads.map((thread) => (
              <div className="list-item" key={`${thread.subject}-${thread.status}`}>
                <span className="label">{thread.status}</span>
                <strong>{thread.subject}</strong>
                <p>{thread.detail}</p>
                <div className="footer-note compact-note">{thread.counterpart}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <span className="label">{messages.policyLabel}</span>
          <h3>{messages.policyTitle}</h3>
          <p>
            {locale === "zh"
              ? "Passport 消息中心优先承载事务性、流程型沟通，例如邀请函、准入审批、证书和支持回复。新闻通讯或品牌传播内容仍应停留在各渠道壳站。"
              : "The Passport message center should prioritize transactional workflow communication such as invitations, access approvals, certificates, and support replies. Newsletters or brand campaigns should remain in the channel shells."}
          </p>
        </div>
      </section>
    </>
  );
}

export async function InfoScreen({ locale, pageKey }: { locale: Locale; pageKey: "about" | "contact" | "terms" | "privacy" | "faq" }) {
  const { page } = await getInfoPageData(locale, pageKey);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{page.label}</span>
          <h1>{page.title}</h1>
        </div>
        <p>{page.intro}</p>
      </div>

      <section className="section">
        <div className="card-grid compact-grid">
          {page.sections.map((section) => (
            <article className="data-card" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export async function LoginScreen({ locale, nextPath }: { locale: Locale; nextPath?: string }) {
  noStore();
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect(sanitizeLocalRedirectPath(nextPath, getDashboardPathForRole(locale, currentUser.role)));
  }

  const { login } = await getLoginPageData(locale);

  return (
    <div className="proto-auth-grid">
      <section className="proto-auth-value">
        <span className="proto-auth-blob proto-auth-blob-1" aria-hidden="true" />
        <span className="proto-auth-blob proto-auth-blob-2" aria-hidden="true" />
        <span className="proto-auth-blob proto-auth-blob-3" aria-hidden="true" />
        <span className="hero-kicker">{login.kicker}</span>
        <h1>{login.title}</h1>
        <p>{login.body}</p>
        <ul className="proto-auth-value-list">
          <li>{locale === "zh" ? "一个护照贯穿所有活动、学习与证书" : "One passport across every event, learning and credential"}</li>
          <li>{locale === "zh" ? "可验证的记录，随时分享给雇主、院校与机构" : "Verifiable records you can share with employers, schools and partners"}</li>
          <li>{locale === "zh" ? "全球气候社区与实践资源网络" : "Global climate community and practitioner network"}</li>
        </ul>
        <blockquote className="proto-auth-testimonial">
          <p>
            {locale === "zh"
              ? "“Climate Passport 让我的学习与参与记录真正属于我。”"
              : "\u201cClimate Passport finally made my learning and participation records truly mine.\u201d"}
          </p>
          <cite>
            {locale === "zh" ? "— Lin Qiao，Climate Fellow" : "— Lin Qiao, Climate Fellow"}
          </cite>
        </blockquote>
      </section>

      <section className="proto-auth-form-side">
        <div className="proto-auth-tabs">
          <Link href={`/${locale}/auth/login`} className="active">{locale === "zh" ? "登录" : "Sign In"}</Link>
          <Link href={`/${locale}/auth/register`}>{locale === "zh" ? "注册" : "Create Account"}</Link>
        </div>
        <span className="label">{login.formLabel}</span>
        <h3>{login.formTitle}</h3>
        <AuthForm
          labels={{
            email: login.email,
            password: login.password,
            submit: login.submit,
          }}
          locale={locale}
          mode="login"
          nextPath={nextPath}
        />
        <div className="button-row top-gap-sm">
          <Link className="button-secondary" href={`/${locale}/auth/register`}>
            {login.switchCta}
          </Link>
        </div>
        <p className="footer-note">{login.note}</p>
      </section>
    </div>
  );
}

export async function RegisterScreen({ locale, nextPath }: { locale: Locale; nextPath?: string }) {
  noStore();
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect(sanitizeLocalRedirectPath(nextPath, getDashboardPathForRole(locale, currentUser.role)));
  }

  const { register } = await getRegisterPageData(locale);

  return (
    <div className="proto-auth-grid">
      <section className="proto-auth-value">
        <span className="proto-auth-blob proto-auth-blob-1" aria-hidden="true" />
        <span className="proto-auth-blob proto-auth-blob-2" aria-hidden="true" />
        <span className="proto-auth-blob proto-auth-blob-3" aria-hidden="true" />
        <span className="hero-kicker">{register.kicker}</span>
        <h1>{register.title}</h1>
        <p>{register.body}</p>
        <ul className="proto-auth-value-list">
          <li>{locale === "zh" ? "领取专属的 Climate Passport ID" : "Claim your unique Climate Passport ID"}</li>
          <li>{locale === "zh" ? "自动同步活动、学习与证书记录" : "Automatically sync event, learning and credential records"}</li>
          <li>{locale === "zh" ? "在世界任何一个角落成为可信贡献者" : "Show up as a credible contributor anywhere in the world"}</li>
        </ul>
        <blockquote className="proto-auth-testimonial">
          <p>
            {locale === "zh"
              ? "“一份护照让我的气候参与获得了真正的诚信起点。”"
              : "\u201cOne passport gave my climate contributions a real trust baseline.\u201d"}
          </p>
          <cite>
            {locale === "zh" ? "— Maya Chen，Verifier" : "— Maya Chen, Verifier"}
          </cite>
        </blockquote>
      </section>

      <section className="proto-auth-form-side">
        <div className="proto-auth-tabs">
          <Link href={`/${locale}/auth/login`}>{locale === "zh" ? "登录" : "Sign In"}</Link>
          <Link href={`/${locale}/auth/register`} className="active">{locale === "zh" ? "注册" : "Create Account"}</Link>
        </div>
        <span className="label">{register.formLabel}</span>
        <h3>{register.formTitle}</h3>
        <AuthForm
          labels={{
            name: register.name,
            email: register.email,
            password: register.password,
            submit: register.submit,
          }}
          locale={locale}
          mode="register"
          nextPath={nextPath}
        />
        <div className="button-row top-gap-sm">
          <Link className="button-secondary" href={`/${locale}/auth/login`}>
            {register.switchCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
