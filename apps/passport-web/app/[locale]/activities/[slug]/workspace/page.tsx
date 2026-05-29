import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

export default async function ActivityWorkspacePage({ params }: { params: { locale: Locale; slug: string } }) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/activities/${params.slug}/workspace`);
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const zh = params.locale === "zh";

  const activity = await prisma.activity.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true, titleEn: true, type: true, status: true },
  });

  if (!activity) notFound();

  const [participation, tasks, checkins, submissions, application] = await Promise.all([
    prisma.activityParticipation.findUnique({
      where: { activityId_userId: { activityId: activity.id, userId: user.id } },
    }),
    prisma.activityTask.findMany({
      where: { activityId: activity.id, parentTaskId: null },
      orderBy: { orderIndex: "asc" },
      include: {
        _count: { select: { submissions: { where: { userId: user.id } }, checkinRecords: { where: { userId: user.id } } } },
        subtasks: {
          orderBy: { orderIndex: "asc" },
          include: {
            _count: { select: { submissions: { where: { userId: user.id } }, checkinRecords: { where: { userId: user.id } } } },
          },
        },
      },
    }),
    prisma.activityCheckinRecord.findMany({
      where: { activityId: activity.id, userId: user.id },
      orderBy: { checkinAt: "desc" },
      take: 10,
    }),
    prisma.activitySubmission.findMany({
      where: { activityId: activity.id, userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { task: { select: { title: true } } },
    }),
    prisma.activityApplication.findUnique({
      where: { activityId_userId: { activityId: activity.id, userId: user.id } },
      select: { status: true },
    }),
  ]);

  // If not participating, redirect to detail page
  if (!participation) {
    redirect(`/${params.locale}/activities/${params.slug}`);
  }

  const STATUS_LABEL: Record<string, { zh: string; en: string }> = {
    REGISTERED: { zh: "已注册", en: "Registered" },
    ACCEPTED: { zh: "已录取", en: "Accepted" },
    CHECKED_IN: { zh: "已签到", en: "Checked In" },
    IN_PROGRESS: { zh: "进行中", en: "In Progress" },
    COMPLETED: { zh: "已完成", en: "Completed" },
    CERTIFIED: { zh: "已认证", en: "Certified" },
    ABSENT: { zh: "缺席", en: "Absent" },
    FAILED: { zh: "未完成", en: "Failed" },
  };

  const CHECKIN_STATUS: Record<string, { zh: string; en: string; cls: string }> = {
    VALID: { zh: "有效", en: "Valid", cls: "cpca-badge cpca-badge-green" },
    DUPLICATE: { zh: "重复", en: "Duplicate", cls: "cpca-badge cpca-badge-amber" },
    INVALID: { zh: "无效", en: "Invalid", cls: "cpca-badge cpca-badge-red" },
    OUTSIDE_WINDOW: { zh: "超窗", en: "Outside Window", cls: "cpca-badge cpca-badge-red" },
  };

  const SUBMISSION_STATUS: Record<string, { zh: string; en: string; cls: string }> = {
    DRAFT: { zh: "草稿", en: "Draft", cls: "" },
    SUBMITTED: { zh: "已提交", en: "Submitted", cls: "cpca-badge cpca-badge-blue" },
    UNDER_REVIEW: { zh: "审核中", en: "Under Review", cls: "cpca-badge cpca-badge-amber" },
    APPROVED: { zh: "已通过", en: "Approved", cls: "cpca-badge cpca-badge-green" },
    REJECTED: { zh: "未通过", en: "Rejected", cls: "cpca-badge cpca-badge-red" },
    REVISION_REQUIRED: { zh: "需修改", en: "Needs Revision", cls: "cpca-badge cpca-badge-amber" },
  };

  // Next Action CTA logic
  const hasCheckinTask = tasks.some((t) => t.taskType === "CHECK_IN" && t._count.checkinRecords === 0 && t.isRequired);
  const hasSubmitTask = tasks.some((t) => t.requiresSubmission && t._count.submissions === 0 && t.isRequired);

  const getNextAction = (): { zh: string; en: string; href?: string } => {
    const s = participation.status;
    if (s === "CERTIFIED") return { zh: "下载证书", en: "Download Certificate" };
    if (s === "COMPLETED") return { zh: "查看证书", en: "View Certificate" };
    if (s === "IN_PROGRESS" && hasCheckinTask) return { zh: "立即打卡", en: "Check In Now", href: `/${params.locale}/activities/${params.slug}/tasks` };
    if (s === "IN_PROGRESS" && hasSubmitTask) return { zh: "提交成果", en: "Submit Work", href: `/${params.locale}/activities/${params.slug}/tasks` };
    if (s === "IN_PROGRESS") return { zh: "查看任务进度", en: "View Task Progress", href: `/${params.locale}/activities/${params.slug}/tasks` };
    if (s === "CHECKED_IN") return { zh: "进入工作台", en: "Enter Workspace" };
    if (s === "ACCEPTED") return { zh: "等待活动开始", en: "Awaiting Start" };
    return { zh: "查看活动详情", en: "View Activity", href: `/${params.locale}/activities/${params.slug}` };
  };

  const nextAction = getNextAction();

  return (
    <main className="page">
      <div className="section-header">
        <div >
          <a href={`/${params.locale}/activities`}>{zh ? "活动中心" : "Activities"}</a>
          <span aria-hidden="true"> / </span>
          <a href={`/${params.locale}/activities/${params.slug}`}>{zh ? activity.title : (activity.titleEn ?? activity.title)}</a>
          <span aria-hidden="true"> / </span>
          <span>{zh ? "我的工作台" : "My Workspace"}</span>
        </div>
        <h1>{zh ? "我的工作台" : "My Workspace"}</h1>
      </div>

      {/* Status + Next Action */}
      <div className="hero-card">
        <div className="status-badge">
          <span className="chip chip">{STATUS_LABEL[participation.status]?.[zh ? "zh" : "en"] ?? participation.status}</span>
          {participation.pointsEarned > 0 && (
            <span style={{ marginLeft: "0.75rem", color: "var(--color-accent)", fontWeight: 600 }}>
              +{participation.pointsEarned} {zh ? "积分" : "pts"}
            </span>
          )}
        </div>
        {nextAction.href ? (
          <Link className="button button" href={nextAction.href}>
            {zh ? nextAction.zh : nextAction.en}
          </Link>
        ) : (
          <button className="button button-secondary" disabled type="button">
            {zh ? nextAction.zh : nextAction.en}
          </button>
        )}
      </div>

      <div className="split">
        {/* Tasks section */}
        <section className="section">
          <h2>{zh ? "我的任务" : "My Tasks"}</h2>
          {tasks.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>{zh ? "暂无任务" : "No tasks assigned"}</p>
          ) : (
            <ol className="list">
              {tasks.map((task) => {
                const checkinDone = task._count.checkinRecords > 0;
                const submitDone = task._count.submissions > 0;
                const done = (task.requiresCheckin ? checkinDone : true) && (task.requiresSubmission ? submitDone : true);
                return (
                  <li className={`list-item ${done ? "list-item" : ""}`} key={task.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong>{task.title}</strong>
                        {task.isRequired && <span className="chip cpca-badge cpca-badge-red chip" style={{ marginLeft: "0.5rem" }}>{zh ? "必做" : "Required"}</span>}
                        {task.points > 0 && <span style={{ marginLeft: "0.5rem", fontSize: "0.85em" }}>{task.points} pts</span>}
                      </div>
                      {done ? (
                        <span className="chip cpca-badge cpca-badge-green">{zh ? "已完成" : "Done"}</span>
                      ) : (
                        <Link className="button button" href={`/${params.locale}/activities/${params.slug}/tasks/${task.id}`}>
                          {zh ? "去完成" : "Go"}
                        </Link>
                      )}
                    </div>
                    {task.subtasks.length > 0 && (
                      <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                        {task.subtasks.map((sub) => (
                          <li key={sub.id} style={{ marginBottom: "0.25rem" }}>
                            {sub.title}
                            {sub._count.checkinRecords > 0 || sub._count.submissions > 0
                              ? <span className="chip cpca-badge cpca-badge-green chip" style={{ marginLeft: "0.5rem" }}>✓</span>
                              : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Checkins section */}
        <section className="section">
          <h2>{zh ? "我的签到" : "My Checkins"}</h2>
          {checkins.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>{zh ? "暂无签到记录" : "No checkins yet"}</p>
          ) : (
            <div className="list">
              {checkins.map((c) => {
                const cs = CHECKIN_STATUS[c.status];
                return (
                  <div className="list-item" key={c.id}>
                    <span>{new Date(c.checkinAt).toLocaleString(zh ? "zh-CN" : "en-US")}</span>
                    <span className={`chip ${cs?.cls ?? ""}`}>{cs?.[zh ? "zh" : "en"] ?? c.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Submissions section */}
        <section className="section">
          <h2>{zh ? "我的提交" : "My Submissions"}</h2>
          {submissions.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>{zh ? "暂无提交记录" : "No submissions yet"}</p>
          ) : (
            <div className="list">
              {submissions.map((s) => {
                const ss = SUBMISSION_STATUS[s.status];
                return (
                  <div className="list-item" key={s.id}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{s.task?.title ?? (zh ? "活动级提交" : "Activity Submission")}</span>
                      {s.score !== null && <span style={{ marginLeft: "0.5rem", fontSize: "0.85em" }}>{zh ? `评分: ${s.score}` : `Score: ${s.score}`}</span>}
                    </div>
                    <span className={`chip ${ss?.cls ?? ""}`}>{ss?.[zh ? "zh" : "en"] ?? s.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Rewards summary */}
        {(participation.pointsEarned > 0 || participation.badgeAwardIds.length > 0 || participation.certificateIssueId) && (
          <section className="section">
            <h2>{zh ? "我的获得" : "My Rewards"}</h2>
            <div className="metric-grid">
              {participation.pointsEarned > 0 && (
                <div className="data-card">
                  <div >{participation.pointsEarned}</div>
                  <div >{zh ? "积分" : "Points"}</div>
                </div>
              )}
              {participation.badgeAwardIds.length > 0 && (
                <div className="data-card">
                  <div >{participation.badgeAwardIds.length}</div>
                  <div >{zh ? "徽章" : "Badges"}</div>
                </div>
              )}
              {participation.certificateIssueId && (
                <div className="data-card">
                  <div >1</div>
                  <div >{zh ? "证书" : "Certificate"}</div>
                </div>
              )}
            </div>
            {participation.passportSynced && (
              <div className="form-error form-success" style={{ marginTop: "0.75rem" }}>
                {zh ? "✓ 已同步到气候护照时间线" : "✓ Synced to Climate Passport Timeline"}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
