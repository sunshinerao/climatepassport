"use client";

export interface HomePagePreviewProps {
  locale?: "zh" | "en";
}

type Locale = "zh" | "en";

const climatePassportTip: Record<Locale, string> = {
  zh: "Climate Passport 是面向气候时代的 AI 驱动可信数字身份基础设施，将个人的气候学习、参与、资质与行动转化为可验证、可携带并持续成长的数字档案。",
  en: "Climate Passport is an AI-driven trusted digital identity infrastructure for the climate era, designed to turn climate learning, participation, credentials and action into a verifiable, portable and continuously growing digital profile.",
};

function HeroSlidePlaceholder({ color }: { color: string }) {
  return (
    <svg
      className="hero-media-image"
      viewBox="0 0 520 360"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="520" height="360" fill={color} />
      <circle cx="260" cy="180" r="90" fill="rgba(255,255,255,0.16)" />
      <circle cx="260" cy="180" r="50" fill="rgba(255,255,255,0.28)" />
    </svg>
  );
}

const HeroCheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const featureIcons = [
  // Digital identity
  <svg key="identity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>,
  // Activity network
  <svg key="network" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5 1.34 3.5 3 3.5z" />
    <path d="M8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11z" />
    <path d="M2 20c0-2.8 2.24-5 5-5h2" />
    <path d="M13 20c0-2.8 2.24-5 5-5h2" />
  </svg>,
  // Trusted certificates
  <svg key="certificates" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>,
  // Learning experience
  <svg key="learning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
    <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
  </svg>,
  // Smart check-in
  <svg key="checkin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>,
  // Impact tracking
  <svg key="impact" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>,
];

export function HomePagePreview({ locale = "zh" }: HomePagePreviewProps) {
  const isZh = locale === "zh";

  const content = {
    badge: isZh
      ? "Connected to a growing global climate community"
      : "Connected to a growing global climate community",
    title: isZh
      ? "为气候时代构建可信数字身份基础设施"
      : "Building trusted digital identity infrastructure for the climate era",
    subtitle: isZh
      ? ["为地球留下行动，为自己积累价值，为未来建立信任", "你为未来做过的事，都值得被看见"]
      : [
          "Leave action for the planet, build value for yourself, and create trust for the future",
          "Everything you have done for the future deserves to be seen",
        ],
    description: isZh
      ? "将个人的气候学习、参与、资质与行动转化为可验证、可携带并持续成长的数字档案。让每一次努力被看见，让每一次行动成为未来的价值。"
      : "Turn climate learning, participation, credentials and action into a verifiable, portable and continuously growing digital profile. Make every effort visible and every action valuable for the future.",
    ctaPrimary: isZh ? "获取护照" : "Get Your Passport",
    ctaSecondary: isZh ? "探索活动" : "Explore Events",
    stats: isZh
      ? [
          { value: "1,200+", label: "参与者" },
          { value: "85+", label: "活动" },
          { value: "42", label: "证书" },
          { value: "15", label: "国家" },
        ]
      : [
          { value: "1,200+", label: "Participants" },
          { value: "85+", label: "Events" },
          { value: "42", label: "Certificates" },
          { value: "15", label: "Countries" },
        ],
    featuresLabel: isZh ? "功能" : "Features",
    featuresTitle: isZh ? "您所需的一切" : "Everything You Need",
    featuresDesc: isZh ? "赋能你的气候行动与成长。" : "A climate action and growth ecosystem.",
    features: isZh
      ? [
          { title: "数字身份", desc: "一个您拥有的统一可携带气候档案。将活动、学习和证书链接为可信赖的行动档案，随处分享。" },
          { title: "活动网络", desc: "涵盖峰会、工作坊、展览和线上项目。无缝注册、数字签到及个性化推荐。" },
          { title: "可信证书", desc: "与个人成长路径关联的可验证资质。设计为可携带、可分享，并更便于机构和组织核验。" },
          { title: "学习体验", desc: "面向实践气候行动能力的项目式学习。学习记录随成长自动积累。" },
          { title: "智能签到", desc: "基于二维码的出席验证和实时参与追踪。出席记录构建您的气候行动历史。" },
          { title: "影响力追踪", desc: "获取积分、追踪成就并衡量您的气候贡献。一份不断增长的经过验证的行动组合。" },
        ]
      : [
          { title: "Digital Identity", desc: "A unified and portable climate profile you own. Connect events, learning, and certificates into a trusted action record you can share anywhere." },
          { title: "Activity Network", desc: "Access summits, workshops, exhibitions, and online programs with seamless registration, digital check-ins, and personalized recommendations." },
          { title: "Trusted Certificates", desc: "Verifiable credentials connected to your growth path. Designed to be portable, shareable and easier for institutions and organizations to verify." },
          { title: "Learning Experience", desc: "Project-based learning focused on practical climate action capability. Learning records accumulate automatically as you grow." },
          { title: "Smart Check-in", desc: "QR-based attendance verification and real-time participation tracking. Attendance records build your climate action history." },
          { title: "Impact Tracking", desc: "Earn points, track achievements, and measure your climate contribution in a continuously growing, verifiable action portfolio." },
        ],
    howLabel: isZh ? "使用方式" : "How It Works",
    howDesc: isZh
      ? "几分钟内开始，成为有意义的行动的一部分"
      : "Get started in minutes and become part of a movement that matters.",
    steps: isZh
      ? [
          { title: "创建档案", desc: "免费注册并获取全球唯一的 Climate Passport ID。建立包含你目标与背景的个人气候身份。" },
          { title: "参与并学习", desc: "参与全球峰会、工作坊与学习项目。你的记录会在每一次参与中自动累积。" },
          { title: "获取与分享", desc: "获取可验证证书、成就与积分。与你的社区随时随地分享气候旅程。" },
        ]
      : [
          { title: "Create Your Profile", desc: "Register for free and claim your globally unique Climate Passport ID. Build your personal climate identity with your goals and background." },
          { title: "Join, Participate & Learn", desc: "Attend summits, workshops and learning programs around the world. Records accumulate automatically as you participate." },
          { title: "Earn & Share", desc: "Receive verifiable certificates, achievements and points. Share your climate journey with the community, anywhere and anytime." },
        ],
    ctaTitle: isZh ? "准备好开始你的气候旅程了吗？" : "Ready to start your climate journey?",
    ctaDesc: isZh
      ? "加入全球气候社区，让你的每一次行动都被看见、被验证、被记住。"
      : "Join the global climate community and make every action visible, verifiable, and memorable.",
    ctaButton: isZh ? "立即获取护照" : "Get Your Passport Now",
  };

  const heroMediaFrames = [
    {
      color: "#c4dcc8",
      label: isZh ? "身份档案" : "Identity",
    },
    {
      color: "#8fb89a",
      label: isZh ? "活动记录" : "Events",
    },
    {
      color: "#e8c88a",
      label: isZh ? "证书里程碑" : "Certificates",
    },
  ];

  return (
    <div className="proto-home">
      {/* Hero */}
      <section className="proto-home-hero">
        <svg className="hero-leaf-deco one" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 10 C30 30, 10 50, 50 90 C70 70, 90 50, 50 10Z" />
        </svg>
        <svg className="hero-leaf-deco two" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 10 C30 30, 10 50, 50 90 C70 70, 90 50, 50 10Z" />
        </svg>

        <div className="proto-home-inner proto-home-hero-inner">
          <div className="hero-content">
            <div className="hero-badge">
              <HeroCheckIcon />
              <span>{content.badge}</span>
            </div>
            <h1 className={isZh ? "proto-title proto-title-hero-unified proto-title-zh-single-line" : "proto-title proto-title-hero-unified"}>
              {content.title}
            </h1>
            <p className="hero-subtitle">
              {content.subtitle[0]}
              <br />
              {content.subtitle[1]}
            </p>
            <p className="hero-desc">
              <span className="hero-brand-with-tip">
                <span className="hero-brand-text">Climate Passport</span>
                <span className="hero-brand-tooltip" role="tooltip">
                  {climatePassportTip[locale]}
                </span>
              </span>{" "}
              {content.description}
            </p>
            <div className="hero-ctas">
              <button className="button button-amber" type="button">
                {content.ctaPrimary}
              </button>
              <button className="button-outline" type="button">
                {content.ctaSecondary}
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-media-loop" aria-label={isZh ? "Climate Passport 自动轮播展示" : "Climate Passport auto-loop showcase"}>
              {heroMediaFrames.map((frame, index) => (
                <figure
                  key={frame.label}
                  className={`hero-media-slide hero-media-slide-${index + 1}`}
                  aria-hidden={index > 0}
                >
                  <HeroSlidePlaceholder color={frame.color} />
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
          {content.stats.map((metric) => (
            <div className="stat-item" key={metric.label}>
              <div className="stat-value">{metric.value}</div>
              <div className="stat-label">{metric.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="section features">
        <div className="proto-home-inner">
          <header className="section-header">
            <span className="section-label">{content.featuresLabel}</span>
            <h2 className="section-title">{content.featuresTitle}</h2>
            <p className="section-desc">{content.featuresDesc}</p>
          </header>
          <div className="feature-cards">
            {content.features.map((feature, index) => (
              <div className="feature-card" key={feature.title}>
                <div className="feature-icon">{featureIcons[index]}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section how-it-works">
        <div className="proto-home-inner">
          <header className="section-header">
            <span className="section-label">{content.howLabel}</span>
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
            <p className="section-desc">{content.howDesc}</p>
          </header>
          <div className="steps">
            {content.steps.map((step, index) => (
              <div className="step" key={step.title}>
                <div className="step-number">{index + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="hp-cta-section">
        <div className="hp-cta-inner">
          <h2 className="hp-cta-title">{content.ctaTitle}</h2>
          <p className="hp-cta-desc">{content.ctaDesc}</p>
          <div className="hp-cta-actions">
            <button className="button button-amber" type="button">
              {content.ctaButton}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePagePreview;
