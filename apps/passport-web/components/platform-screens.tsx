import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { ContactMessageForm } from "@/components/contact-message-form";
import { NotificationPreferencesForm } from "@/components/notification-preferences-form";
import { EventsFilterableGrid } from "@/components/events-filterable-grid";
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

export async function HomeScreen({ locale }: { locale: Locale }) {
  const { home } = await getHomePageData(locale);
  const isZh = locale === "zh";
  const summerSchoolApplyHref = `/learning-experience/summer-school-2026/apply?lang=${isZh ? "zh" : "en"}`;

  return (
    <>
      <section className="proto-home-hero">
        <div>
          <div className="eyebrow">{home.kicker}</div>
          <h1
            className="proto-title"
            dangerouslySetInnerHTML={{
              __html: isZh
                ? home.title.replace("气候", '<span class="proto-title-accent">气候</span>')
                : home.title.replace("Climate", "<em>Climate</em>"),
            }}
          />
          <p className="proto-subtitle">{home.body}</p>
          <div className="button-row">
            <Link className="button button-amber" href={`/${locale}/auth/register`}>
              {home.primaryCta}
            </Link>
            <Link className="button-outline" href={`/${locale}/events`}>
              {isZh ? "浏览活动" : "Browse Events"}
            </Link>
            <Link className="button-outline" href={summerSchoolApplyHref}>
              {isZh ? "夏校申请" : "Summer School Apply"}
            </Link>
          </div>
        </div>
        <div className="proto-passport-card">
          <span className="chip">Climate Passport</span>
          <h3>{isZh ? "统一气候身份" : "Unified Climate Identity"}</h3>
          <p>{isZh ? "连接活动、学习与证书验证，形成可持续行动档案。" : "Link events, learning and credential verification into a trusted action profile."}</p>
          <div className="proto-passport-meta">
            <div><strong>1,240</strong><span>{isZh ? "积分" : "Points"}</span></div>
            <div><strong>12</strong><span>{isZh ? "活动" : "Events"}</span></div>
            <div><strong>7</strong><span>{isZh ? "证书" : "Certificates"}</span></div>
          </div>
        </div>
      </section>

      <section className="proto-stats-strip">
        {home.metrics.map((metric) => (
          <article key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </article>
        ))}
      </section>

      <section className="proto-feature-grid">
        <article className="data-card">
          <h3>{isZh ? "活动网络" : "Events Network"}</h3>
          <p>{isZh ? "覆盖峰会、工作坊、展览和在线项目。" : "Across summits, workshops, exhibitions and online programs."}</p>
        </article>
        <article className="data-card">
          <h3>{isZh ? "可信证书" : "Trusted Credentials"}</h3>
          <p>{isZh ? "证书可核验，关联个人成长路径。" : "Verifiable certificates linked to personal growth pathways."}</p>
        </article>
        <article className="data-card">
          <h3>{isZh ? "学习体验" : "Learning Experiences"}</h3>
          <p>{isZh ? "通过项目化学习形成真实气候行动能力。" : "Project-based learning for practical climate action capabilities."}</p>
        </article>
      </section>

      <section className="proto-how-it-works">
        <header>
          <span className="label">{isZh ? "使用流程" : "How it works"}</span>
          <h2>{isZh ? "三步开启你的气候护照" : "Three steps to launch your climate passport"}</h2>
        </header>
        <ol className="proto-how-it-works-steps">
          <li>
            <span className="proto-step-num">01</span>
            <strong>{isZh ? "创建护照账号" : "Create your passport"}</strong>
            <p>{isZh ? "免费注册并领取全球唯一的 Climate Passport ID。" : "Register for free and claim your globally unique Climate Passport ID."}</p>
          </li>
          <li>
            <span className="proto-step-num">02</span>
            <strong>{isZh ? "参与活动与学习" : "Participate and learn"}</strong>
            <p>{isZh ? "报名峰会、工作坊与学习项目，自动积累参与记录。" : "Attend summits, workshops and learning programs — records accumulate automatically."}</p>
          </li>
          <li>
            <span className="proto-step-num">03</span>
            <strong>{isZh ? "获取证书与成就" : "Earn verified credentials"}</strong>
            <p>{isZh ? "获取可验证的证书、成就与积分，随时分享到任何平台。" : "Receive verifiable certificates, achievements and points — shareable anywhere."}</p>
          </li>
        </ol>
      </section>

      <section className="proto-newsletter">
        <div>
          <span className="label">{isZh ? "保持连接" : "Stay Updated"}</span>
          <h2>{isZh ? "加入全球气候行动者网络" : "Join the Global Climate Action Network"}</h2>
        </div>
        <div className="newsletter-form-row">
          <input type="email" placeholder={isZh ? "输入邮箱" : "Enter your email"} aria-label={isZh ? "邮箱" : "Email"} />
          <Link className="button button-amber" href={`/${locale}/auth/register`}>
            {isZh ? "立即加入" : "Get Started"}
          </Link>
        </div>
      </section>
    </>
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
    redirect(nextPath || getDashboardPathForRole(locale, currentUser.role));
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
    redirect(nextPath || getDashboardPathForRole(locale, currentUser.role));
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