import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";
import { activityEventJsonLd } from "@/lib/seo";
import { EventDetailSections } from "@/components/event-detail-sections";
import { isActivityRegistrationUnavailable } from "@/lib/server/activity-event-utils";
import { ActivityPosterButtons } from "@/components/activity-poster-buttons";

export default async function ActivityDetailPage({ params }: { params: { locale: Locale; slug: string } }) {
  noStore();
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const zh = params.locale === "zh";

  const activity = await prisma.activity.findUnique({
    where: { slug: params.slug },
    include: {
      tasks: {
        where: { parentTaskId: null, isRequired: true },
        orderBy: { orderIndex: "asc" },
        take: 10,
      },
      _count: { select: { participations: true } },
      // EVENT type relations
      agendaItems: {
        orderBy: [{ agendaDate: "asc" }, { startTime: "asc" }, { order: "asc" }],
        include: {
          moderator: {
            select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
          },
          speakers: {
            orderBy: { order: "asc" },
            include: {
              speaker: {
                select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
              },
            },
          },
        },
      },
      speakerLinks: {
        orderBy: { order: "asc" },
        include: {
          speaker: {
            select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, bio: true, bioEn: true, avatar: true },
          },
        },
      },
    },
  });

  if (!activity || (activity.visibility === "PRIVATE" && activity.status !== "PUBLISHED" && activity.status !== "ONGOING")) {
    notFound();
  }

  // Fetch type-specific detail config
  const activityDetail = await prisma.activityDetail.findUnique({
    where: { activityId: activity.id },
    select: { configJson: true },
  });

  // Check if user is logged in
  let userId: string | null = null;
  let participation: { status: string } | null = null;
  let application: { status: string } | null = null;
  let wishlisted = false;

  try {
    const user = await requireAuthenticatedUser(params.locale);
    userId = user.id;
    const [p, a, w] = await Promise.all([
      prisma.activityParticipation.findUnique({
        where: { activityId_userId: { activityId: activity.id, userId: user.id } },
        select: { status: true },
      }),
      prisma.activityApplication.findUnique({
        where: { activityId_userId: { activityId: activity.id, userId: user.id } },
        select: { status: true },
      }),
      prisma.activityWishlist.findUnique({
        where: { userId_activityId: { userId: user.id, activityId: activity.id } },
        select: { id: true },
      }),
    ]);
    participation = p;
    application = a;
    wishlisted = !!w;
  } catch {
    // Not logged in — public view
  }

  const TYPE_LABELS: Record<string, { zh: string; en: string }> = {
    EVENT: { zh: "活动", en: "Event" },
    LEARNING: { zh: "学习", en: "Learning" },
    CHALLENGE: { zh: "挑战", en: "Challenge" },
    PROJECT: { zh: "项目", en: "Project" },
    TASK: { zh: "任务", en: "Task" },
    COURSE: { zh: "课程", en: "Course" },
  };

  const EVENT_LAYER_LABELS: Record<string, { zh: string; en: string }> = {
    INSTITUTION: { zh: "机构级", en: "Institution" },
    ECONOMY: { zh: "经济体", en: "Economy" },
    ROOT: { zh: "主办", en: "Official" },
    ACCELERATOR: { zh: "加速器", en: "Accelerator" },
    COMPREHENSIVE: { zh: "综合", en: "Comprehensive" },
  };

  const isRegistrationOpen =
    (activity.status === "PUBLISHED" || activity.status === "ONGOING") &&
    (!activity.registrationOpenAt || new Date(activity.registrationOpenAt) <= new Date()) &&
    (!activity.registrationCloseAt || new Date(activity.registrationCloseAt) >= new Date()) &&
    !isActivityRegistrationUnavailable(activity);

  const registrationUnavailable = isActivityRegistrationUnavailable(activity);
  const structuredData = activityEventJsonLd(activity, params.locale);

  // Serialize dates for client components
  const serializedActivity = {
    ...activity,
    startTime: activity.startTime?.toISOString() ?? null,
    endTime: activity.endTime?.toISOString() ?? null,
    registrationOpenAt: activity.registrationOpenAt?.toISOString() ?? null,
    registrationCloseAt: activity.registrationCloseAt?.toISOString() ?? null,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
    agendaItems: activity.agendaItems.map((item) => ({
      ...item,
      agendaDate: item.agendaDate.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };

  if (activity.type === "EVENT") {
    return (
      <main className="page">
        {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />}
        {/* Hero / poster */}
        {(activity as any).posterImage && (
          <div style={{ width: "100%", maxHeight: 400, overflow: "hidden", borderRadius: "0.75rem", marginBottom: "1.5rem" }}>
            <img
              alt={zh ? activity.title : (activity.titleEn ?? activity.title)}
              src={(activity as any).posterImage}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        <div className="section-header">
          <div >
            <a href={`/${params.locale}/activities`}>{zh ? "活动中心" : "Activities"}</a>
            <span aria-hidden="true"> / </span>
            <span>{zh ? activity.title : (activity.titleEn ?? activity.title)}</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
            <span className="chip cpca-badge cpca-badge-blue">{TYPE_LABELS[activity.type]?.[zh ? "zh" : "en"] ?? activity.type}</span>
            {(activity as any).eventLayer && (
              <span className="chip chip">
                {EVENT_LAYER_LABELS[(activity as any).eventLayer]?.[zh ? "zh" : "en"] ?? (activity as any).eventLayer}
              </span>
            )}
            {(activity as any).isPrivate && (
              <span className="chip" style={{ background: "#7c3aed", color: "#fff" }}>{zh ? "闭门会" : "Closed Door"}</span>
            )}
            {activity.isFeatured && <span className="chip cpca-badge cpca-badge-amber">{zh ? "精选" : "Featured"}</span>}
            {(activity as any).isPinned && <span className="chip" style={{ background: "#dc2626", color: "#fff" }}>{zh ? "置顶" : "Pinned"}</span>}
          </div>
          <h1 style={{ marginBottom: "0.25rem" }}>{zh ? activity.title : (activity.titleEn ?? activity.title)}</h1>
          {(zh ? activity.subtitle : ((activity as any).subtitleEn ?? activity.subtitle)) && (
            <p className="compact-note">{zh ? activity.subtitle : ((activity as any).subtitleEn ?? activity.subtitle)}</p>
          )}
        </div>

        <div className="split">
          <div >
            {/* Description */}
            {(zh ? activity.description : ((activity as any).descriptionEn ?? activity.description)) && (
              <section className="section">
                <h2>{zh ? "活动介绍" : "About"}</h2>
                <div >
                  {zh ? activity.description : ((activity as any).descriptionEn ?? activity.description)}
                </div>
              </section>
            )}

            {/* Highlights */}
            {Array.isArray((activity as any).highlights) && (activity as any).highlights.length > 0 && (
              <section className="section">
                <h2>{zh ? "活动亮点" : "Highlights"}</h2>
                <ul className="list">
                  {((activity as any).highlights as string[]).map((h, i) => (
                    <li className="list-item" key={i}>{h}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Agenda */}
            {activity.agendaItems.length > 0 && (
              <section className="section">
                <h2>{zh ? "活动议程" : "Agenda"}</h2>
                <EventDetailSections
                  agendaItems={serializedActivity.agendaItems as any}
                  locale={params.locale}
                />
              </section>
            )}

            {/* Speakers grid */}
            {activity.speakerLinks.length > 0 && (
              <section className="section">
                <h2>{zh ? "活动嘉宾" : "Speakers"}</h2>
                <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                  {activity.speakerLinks.map((sl) => (
                    <div className="data-card" key={sl.id} style={{ textAlign: "center", padding: "1rem" }}>
                      {sl.speaker.avatar
                        ? <img alt={sl.speaker.name} src={sl.speaker.avatar} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", margin: "0 auto 0.5rem" }} />
                        : <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#e5e7eb", margin: "0 auto 0.5rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--cp-fs-28)", color: "#6b7280" }}>👤</div>
                      }
                      <div style={{ fontWeight: 600 }}>{zh ? sl.speaker.name : (sl.speaker.nameEn ?? sl.speaker.name)}</div>
                      {(sl.role || sl.roleEn) && (
                        <div style={{ fontSize: "var(--cp-text-small)", color: "#6b7280", marginTop: 2 }}>{zh ? sl.role : (sl.roleEn ?? sl.role)}</div>
                      )}
                      {(sl.speaker.title || sl.speaker.titleEn) && (
                        <div style={{ fontSize: "var(--cp-text-small)", color: "#9ca3af" }}>{zh ? sl.speaker.title : (sl.speaker.titleEn ?? sl.speaker.title)}</div>
                      )}
                      {(sl.speaker.organization || (sl.speaker as any).organizationEn) && (
                        <div style={{ fontSize: "var(--cp-text-caption)", color: "#9ca3af" }}>{zh ? sl.speaker.organization : ((sl.speaker as any).organizationEn ?? sl.speaker.organization)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Map embed */}
            {(activity as any).mapUrl && (
              <section className="section">
                <h2>{zh ? "活动地点" : "Location"}</h2>
                <div style={{ width: "100%", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid #e5e7eb" }}>
                  <iframe
                    allowFullScreen
                    height={360}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={(activity as any).mapUrl}
                    style={{ width: "100%", border: 0 }}
                    title={zh ? "地图" : "Map"}
                    width="100%"
                  />
                </div>
              </section>
            )}
          </div>

          <aside >
            <div className="data-card">
              <h3>{zh ? "活动信息" : "Event Details"}</h3>
              <dl >
                {activity.startTime && (
                  <>
                    <dt>{zh ? "开始时间" : "Start"}</dt>
                    <dd>{new Date(activity.startTime).toLocaleString(zh ? "zh-CN" : "en-US", { timeZone: activity.timezone ?? "Asia/Shanghai" })}</dd>
                  </>
                )}
                {activity.endTime && (
                  <>
                    <dt>{zh ? "结束时间" : "End"}</dt>
                    <dd>{new Date(activity.endTime).toLocaleString(zh ? "zh-CN" : "en-US", { timeZone: activity.timezone ?? "Asia/Shanghai" })}</dd>
                  </>
                )}
                {activity.locationType && (
                  <>
                    <dt>{zh ? "形式" : "Format"}</dt>
                    <dd>
                      {activity.locationType === "ONLINE" ? (zh ? "线上" : "Online") :
                       activity.locationType === "OFFLINE" ? (zh ? "线下" : "In-person") :
                       (zh ? "线上+线下" : "Hybrid")}
                    </dd>
                  </>
                )}
                {activity.onlineUrl && (
                  <>
                    <dt>{zh ? "在线链接" : "Online"}</dt>
                    <dd><a href={activity.onlineUrl} rel="noopener noreferrer" target="_blank">{zh ? "点击访问" : "Join"}</a></dd>
                  </>
                )}
                {activity.capacity && (
                  <>
                    <dt>{zh ? "名额" : "Capacity"}</dt>
                    <dd>{activity.capacity} {zh ? "人" : "seats"}</dd>
                  </>
                )}
                <dt>{zh ? "已报名" : "Registered"}</dt>
                <dd>{activity._count.participations}</dd>
                {activity.organizerName && (
                  <>
                    <dt>{zh ? "主办方" : "Organizer"}</dt>
                    <dd>{activity.organizerName}</dd>
                  </>
                )}
              </dl>

              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {participation ? (
                  <>
                    <div className="form-error form-success">
                      {zh ? `已报名 · ${participation.status}` : `Registered · ${participation.status}`}
                    </div>
                  </>
                ) : application ? (
                  <div className="form-error form-success">
                    {zh ? `已申请 · ${application.status}` : `Applied · ${application.status}`}
                  </div>
                ) : (activity as any).isPrivate && !participation ? (
                  <div className="form-error form-success">
                    {zh ? "闭门活动，请通过主办方联系报名" : "Closed-door event. Contact the organizer to register."}
                  </div>
                ) : registrationUnavailable && userId ? (
                  <div className="form-error form-success">
                    {zh ? "报名已截止" : "Registration closed"}
                  </div>
                ) : isRegistrationOpen && userId ? (
                  <a
                    className="button button button"
                    href={`/${params.locale}/activities/${params.slug}/apply`}
                    style={{ display: "block", textAlign: "center" }}
                  >
                    {activity.requiresApproval ? (zh ? "申请参与" : "Apply") : (zh ? "立即报名" : "Register Now")}
                  </a>
                ) : isRegistrationOpen ? (
                  <a
                    className="button button button"
                    href={`/${params.locale}/login?next=/${params.locale}/activities/${params.slug}`}
                    style={{ display: "block", textAlign: "center" }}
                  >
                    {zh ? "登录后报名" : "Login to Register"}
                  </a>
                ) : (
                  <div className="form-error form-success">
                    {zh ? "报名暂未开放" : "Registration not open"}
                  </div>
                )}

                {/* Wishlist toggle */}
                {userId && !participation && (
                  <form action={`/api/activities/${activity.id}/wishlist`} method="POST">
                    <button
                      className="button button-secondary button button"
                      style={{ width: "100%" }}
                      type="submit"
                    >
                      {wishlisted ? (zh ? "❤️ 已收藏" : "❤️ Wishlisted") : (zh ? "🤍 收藏活动" : "🤍 Add to Wishlist")}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Share QR code */}
            <div className="data-card" style={{ marginTop: "1rem", textAlign: "center" }}>
              <p style={{ fontSize: "var(--cp-text-small)", color: "#6b7280", margin: "0 0 0.5rem" }}>
                {zh ? "扫码分享活动" : "Share this event"}
              </p>
              <img
                alt="QR Code"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${params.locale}/activities/${params.slug}`)}`}
                style={{ display: "block", margin: "0 auto", borderRadius: "0.25rem" }}
              />
              <a
                className="button button button-secondary"
                href={`/${params.locale}/activities/${params.slug}/poster`}
                style={{ display: "inline-block", marginTop: "0.75rem", fontSize: "var(--cp-text-small)" }}
              >
                {zh ? "查看活动海报" : "View Event Poster"}
              </a>
              <ActivityPosterButtons
                activity={{
                  title: activity.title,
                  titleEn: activity.titleEn,
                  startTime: activity.startTime?.toISOString() ?? null,
                  endTime: activity.endTime?.toISOString() ?? null,
                  timezone: activity.timezone,
                  locationJson: activity.locationJson as Record<string, string> | null,
                  organizerName: activity.organizerName,
                  posterImage: (activity as any).posterImage ?? null,
                  slug: params.slug,
                  locale: params.locale,
                }}
                locale={params.locale}
              />
            </div>

            {activity.tags.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                {activity.tags.map((tag) => (
                  <span className="chip chip" key={tag} style={{ marginRight: "0.25rem", marginBottom: "0.25rem" }}>{tag}</span>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
    );
  }

  // ---- Non-EVENT type ----
  return (
    <main className="page page">
      <div className="section-header">
        <div >
          <a href={`/${params.locale}/activities`}>{zh ? "活动中心" : "Activities"}</a>
          <span aria-hidden="true"> / </span>
          <span>{zh ? activity.title : (activity.titleEn ?? activity.title)}</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
          <span className="chip chip">{activity.type}</span>
          <span className="chip">{activity.status}</span>
          {activity.isFeatured && <span className="chip cpca-badge cpca-badge-amber">{zh ? "精选" : "Featured"}</span>}
        </div>
        <h1>{zh ? activity.title : (activity.titleEn ?? activity.title)}</h1>
        {(zh ? activity.subtitle : ((activity as any).subtitleEn ?? activity.subtitle)) && (
          <p className="compact-note">{zh ? activity.subtitle : ((activity as any).subtitleEn ?? activity.subtitle)}</p>
        )}
      </div>

      <div className="split">
        <div >
          {(zh ? activity.description : ((activity as any).descriptionEn ?? activity.description)) && (
            <section className="section">
              <h2>{zh ? "活动介绍" : "About"}</h2>
              <div >
                {zh ? activity.description : ((activity as any).descriptionEn ?? activity.description)}
              </div>
            </section>
          )}

          {activity.tasks.length > 0 && (
            <section className="section">
              <h2>{zh ? "必做任务" : "Required Tasks"}</h2>
              <ol className="list">
                {activity.tasks.map((task) => (
                  <li className="list-item" key={task.id}>
                    <div style={{ fontWeight: 600 }}>{task.title}</div>
                    {task.description && <p style={{ margin: "0.25rem 0 0", fontSize: "var(--cp-text-small)" }}>{task.description}</p>}
                    <div style={{ fontSize: "var(--cp-text-small)", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                      <span className="chip chip">{task.taskType}</span>
                      {task.points > 0 && <span style={{ marginLeft: "0.5rem" }}>{task.points} pts</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Type-specific content from ActivityDetail.configJson */}
          {activityDetail?.configJson && (() => {
            const cfg = activityDetail.configJson as Record<string, unknown>;
            return (
              <>
                {Array.isArray(cfg.agenda) && (cfg.agenda as { time?: string; title: string; speaker?: string }[]).length > 0 && (
                  <section className="section">
                    <h2>{zh ? "活动议程" : "Agenda"}</h2>
                    <div className="list">
                      {(cfg.agenda as { time?: string; title: string; speaker?: string }[]).map((item, i) => (
                        <div className="list-item" key={i}>
                          {item.time && <span style={{ fontFamily: "var(--cp-font-mono)", minWidth: "5rem" }}>{item.time}</span>}
                          <span style={{ flex: 1 }}>{item.title}</span>
                          {item.speaker && <span style={{ color: "var(--color-text-muted)", fontSize: "var(--cp-text-small)" }}>{item.speaker}</span>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {typeof cfg.venue === "object" && cfg.venue !== null && (
                  <section className="section">
                    <h2>{zh ? "活动地点" : "Venue"}</h2>
                    <dl >
                      {(cfg.venue as Record<string, string>).name && <><dt>{zh ? "地点" : "Name"}</dt><dd>{(cfg.venue as Record<string, string>).name}</dd></>}
                      {(cfg.venue as Record<string, string>).address && <><dt>{zh ? "地址" : "Address"}</dt><dd>{(cfg.venue as Record<string, string>).address}</dd></>}
                      {(cfg.venue as Record<string, string>).room && <><dt>{zh ? "房间" : "Room"}</dt><dd>{(cfg.venue as Record<string, string>).room}</dd></>}
                    </dl>
                  </section>
                )}

                {Array.isArray(cfg.curriculum) && (cfg.curriculum as string[]).length > 0 && (
                  <section className="section">
                    <h2>{zh ? "课程内容" : "Curriculum"}</h2>
                    <ol className="list">
                      {(cfg.curriculum as string[]).map((item, i) => (
                        <li className="list-item" key={i}>{item}</li>
                      ))}
                    </ol>
                  </section>
                )}

                {Array.isArray(cfg.requirements) && (cfg.requirements as string[]).length > 0 && (
                  <section className="section">
                    <h2>{zh ? "参与要求" : "Requirements"}</h2>
                    <ul className="list">
                      {(cfg.requirements as string[]).map((r, i) => (
                        <li className="list-item" key={i}>{r}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {typeof cfg.rules === "string" && cfg.rules && (
                  <section className="section">
                    <h2>{zh ? "规则说明" : "Rules"}</h2>
                    <div >{cfg.rules as string}</div>
                  </section>
                )}

                {/* CHALLENGE type — challenge rules */}
                {typeof cfg.challenge_rules === "string" && cfg.challenge_rules && (
                  <section className="section">
                    <h2>{zh ? "挑战规则" : "Challenge Rules"}</h2>
                    <div >{cfg.challenge_rules as string}</div>
                  </section>
                )}

                {/* CHALLENGE type — scoring */}
                {typeof cfg.scoring_rules === "object" && cfg.scoring_rules !== null && (
                  <section className="section">
                    <h2>{zh ? "积分规则" : "Scoring Rules"}</h2>
                    <dl >
                      {typeof (cfg.scoring_rules as Record<string, unknown>).base_points === "number" && (
                        <>
                          <dt>{zh ? "基础积分" : "Base Points"}</dt>
                          <dd>{(cfg.scoring_rules as Record<string, unknown>).base_points as number}</dd>
                        </>
                      )}
                      {Array.isArray((cfg.scoring_rules as Record<string, unknown>).bonus_conditions) &&
                        ((cfg.scoring_rules as Record<string, unknown>).bonus_conditions as unknown[]).length > 0 && (
                        <>
                          <dt>{zh ? "加分条件" : "Bonus Conditions"}</dt>
                          <dd>
                            <ul className="list">
                              {((cfg.scoring_rules as Record<string, unknown>).bonus_conditions as string[]).map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          </dd>
                        </>
                      )}
                    </dl>
                  </section>
                )}

                {/* CHALLENGE type — team info */}
                {cfg.team_enabled === true && (
                  <section className="section">
                    <h2>{zh ? "团队参与" : "Team Participation"}</h2>
                    <dl >
                      <dt>{zh ? "队伍规模" : "Max Team Size"}</dt>
                      <dd>
                        {typeof cfg.max_team_size === "number"
                          ? (zh ? `最多 ${cfg.max_team_size} 人` : `Up to ${cfg.max_team_size} members`)
                          : (zh ? "不限" : "No limit")}
                      </dd>
                    </dl>
                  </section>
                )}

                {/* CHALLENGE type — task series */}
                {Array.isArray(cfg.task_series) && (cfg.task_series as unknown[]).length > 0 && (
                  <section className="section">
                    <h2>{zh ? "任务序列" : "Task Series"}</h2>
                    <ol className="list">
                      {(cfg.task_series as { title?: string; description?: string }[]).map((t, i) => (
                        <li className="list-item" key={i}>
                          <strong>{t.title ?? `Task ${i + 1}`}</strong>
                          {t.description && <span style={{ marginLeft: "0.5rem", color: "var(--color-text-muted)" }}>{t.description}</span>}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {/* PROJECT type — milestones */}
                {Array.isArray(cfg.milestones) && (cfg.milestones as unknown[]).length > 0 && (
                  <section className="section">
                    <h2>{zh ? "项目里程碑" : "Milestones"}</h2>
                    <div className="list">
                      {(cfg.milestones as { title: string; due_date?: string; deliverables?: string[] }[]).map((m, i) => (
                        <div className="list-item" key={i} style={{ flexDirection: "column", alignItems: "flex-start" }}>
                          <strong>{m.title}</strong>
                          {m.due_date && <span style={{ fontSize: "var(--cp-text-small)", color: "var(--color-text-muted)" }}>{zh ? "截止：" : "Due: "}{m.due_date}</span>}
                          {Array.isArray(m.deliverables) && m.deliverables.length > 0 && (
                            <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0 }}>
                              {m.deliverables.map((d, j) => <li key={j} style={{ fontSize: "var(--cp-text-small)" }}>{d}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* PROJECT type — project background */}
                {typeof cfg.project_background === "string" && cfg.project_background && (
                  <section className="section">
                    <h2>{zh ? "项目背景" : "Project Background"}</h2>
                    <div >{cfg.project_background as string}</div>
                  </section>
                )}

                {/* PROJECT type — roles available */}
                {Array.isArray(cfg.roles_available) && (cfg.roles_available as unknown[]).length > 0 && (
                  <section className="section">
                    <h2>{zh ? "招募角色" : "Roles Available"}</h2>
                    <div className="list">
                      {(cfg.roles_available as { role: string; quota?: number; description?: string }[]).map((r, i) => (
                        <div className="list-item" key={i}>
                          <span className="chip chip">{r.role}</span>
                          {typeof r.quota === "number" && <span style={{ fontSize: "var(--cp-text-small)" }}>{zh ? `名额: ${r.quota}` : `Quota: ${r.quota}`}</span>}
                          {r.description && <span style={{ fontSize: "var(--cp-text-small)", color: "var(--color-text-muted)" }}>{r.description}</span>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            );
          })()}
        </div>

        <aside >
          <div className="data-card">
            <h3>{zh ? "活动信息" : "Details"}</h3>
            <dl >
              {activity.startTime && (
                <>
                  <dt>{zh ? "开始时间" : "Start"}</dt>
                  <dd>{new Date(activity.startTime).toLocaleString(zh ? "zh-CN" : "en-US")}</dd>
                </>
              )}
              {activity.endTime && (
                <>
                  <dt>{zh ? "结束时间" : "End"}</dt>
                  <dd>{new Date(activity.endTime).toLocaleString(zh ? "zh-CN" : "en-US")}</dd>
                </>
              )}
              {activity.locationType && (
                <>
                  <dt>{zh ? "形式" : "Format"}</dt>
                  <dd>{activity.locationType}</dd>
                </>
              )}
              {activity.onlineUrl && (
                <>
                  <dt>{zh ? "在线链接" : "Online URL"}</dt>
                  <dd><a href={activity.onlineUrl} rel="noopener noreferrer" target="_blank">{zh ? "点击访问" : "Visit"}</a></dd>
                </>
              )}
              {activity.capacity && (
                <>
                  <dt>{zh ? "名额" : "Capacity"}</dt>
                  <dd>{activity.capacity}</dd>
                </>
              )}
              <dt>{zh ? "已参与" : "Participants"}</dt>
              <dd>{activity._count.participations}</dd>
              {activity.organizerName && (
                <>
                  <dt>{zh ? "主办方" : "Organizer"}</dt>
                  <dd>{activity.organizerName}</dd>
                </>
              )}
            </dl>

            <div style={{ marginTop: "1rem" }}>
              {participation ? (
                <>
                  <div className="form-error form-success">
                    {zh ? `已参与 · 状态：${participation.status}` : `Participating · Status: ${participation.status}`}
                  </div>
                  <a className="button button button" href={`/${params.locale}/activities/${params.slug}/workspace`} style={{ marginTop: "0.75rem", display: "block", textAlign: "center" }}>
                    {zh ? "进入工作台 →" : "Go to Workspace →"}
                  </a>
                </>
              ) : application ? (
                <div className="form-error form-success">
                  {zh ? `已申请 · 状态：${application.status}` : `Applied · Status: ${application.status}`}
                </div>
              ) : isRegistrationOpen && userId ? (
                <a className="button button button" href={`/${params.locale}/activities/${params.slug}/apply`} style={{ display: "block", textAlign: "center" }}>
                  {activity.requiresApproval
                    ? (zh ? "申请参与" : "Apply to Participate")
                    : (zh ? "立即报名" : "Register Now")}
                </a>
              ) : isRegistrationOpen ? (
                <a className="button button button" href={`/${params.locale}/login?next=/${params.locale}/activities/${params.slug}`}>
                  {zh ? "登录后报名" : "Login to Register"}
                </a>
              ) : (
                <div className="form-error form-success">
                  {zh ? "报名暂未开放" : "Registration not open"}
                </div>
              )}
            </div>
          </div>

          {activity.tags.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              {activity.tags.map((tag) => (
                <span className="chip chip" key={tag} style={{ marginRight: "0.25rem", marginBottom: "0.25rem" }}>{tag}</span>
              ))}
            </div>
          )}

          {/* CHALLENGE leaderboard shortcut */}
          {activity.type === "CHALLENGE" && (
            <div style={{ marginTop: "1rem" }}>
              <a
                className="button button button"
                href={`/${params.locale}/activities/${params.slug}/leaderboard`}
                style={{ display: "block", textAlign: "center" }}
              >
                {zh ? "📊 查看排行榜" : "📊 View Leaderboard"}
              </a>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
