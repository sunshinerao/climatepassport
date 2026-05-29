import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";
import TaskSubmitClient from "@/components/task-submit-client";

export default async function TaskDetailPage({
  params,
}: {
  params: { locale: Locale; slug: string; taskId: string };
}) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/activities/${params.slug}/tasks/${params.taskId}`);
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const zh = params.locale === "zh";

  const activity = await prisma.activity.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true, titleEn: true },
  });
  if (!activity) notFound();

  // Check user has active participation
  const participation = await prisma.activityParticipation.findUnique({
    where: { activityId_userId: { activityId: activity.id, userId: user.id } },
    select: { status: true },
  });
  if (!participation || ["ABSENT", "FAILED", "ARCHIVED"].includes(participation.status)) {
    redirect(`/${params.locale}/activities/${params.slug}`);
  }

  const task = await prisma.activityTask.findUnique({
    where: { id: params.taskId },
    include: {
      subtasks: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (!task || task.activityId !== activity.id) notFound();

  const [checkins, submissions] = await Promise.all([
    prisma.activityCheckinRecord.findMany({
      where: { taskId: task.id, userId: user.id },
      orderBy: { checkinAt: "desc" },
      take: 5,
    }),
    prisma.activitySubmission.findMany({
      where: { taskId: task.id, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const hasValidCheckin = checkins.some((c) => c.status === "VALID");
  const hasSubmission = submissions.length > 0;

  return (
    <main className="page page">
      <div className="section-header">
        <div >
          <a href={`/${params.locale}/activities`}>{zh ? "活动中心" : "Activities"}</a>
          <span aria-hidden="true"> / </span>
          <a href={`/${params.locale}/activities/${params.slug}`}>{zh ? activity.title : (activity.titleEn ?? activity.title)}</a>
          <span aria-hidden="true"> / </span>
          <a href={`/${params.locale}/activities/${params.slug}/workspace`}>{zh ? "工作台" : "Workspace"}</a>
          <span aria-hidden="true"> / </span>
          <span>{task.title}</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0" }}>
          <span className="chip chip">{task.taskType}</span>
          {task.isRequired && <span className="chip cpca-badge cpca-badge-red">{zh ? "必做" : "Required"}</span>}
          {task.points > 0 && <span className="chip">{task.points} pts</span>}
        </div>
        <h1>{task.title}</h1>
        {task.description && <p className="compact-note">{task.description}</p>}
      </div>

      {(task.startTime || task.dueTime) && (
        <div  style={{ marginBottom: "1rem" }}>
          {task.startTime && <span>{zh ? `开放时间：${new Date(task.startTime).toLocaleString("zh-CN")}` : `Opens: ${new Date(task.startTime).toLocaleString("en-US")}`}</span>}
          {task.dueTime && <span style={{ marginLeft: "1rem", color: "var(--color-warning)" }}>{zh ? `截止时间：${new Date(task.dueTime).toLocaleString("zh-CN")}` : `Due: ${new Date(task.dueTime).toLocaleString("en-US")}`}</span>}
        </div>
      )}

      <TaskSubmitClient
        activityId={activity.id}
        hasExistingSubmission={hasSubmission}
        locale={params.locale}
        requiresCheckin={task.requiresCheckin && !hasValidCheckin}
        requiresSubmission={task.requiresSubmission}
        taskId={task.id}
        taskType={task.taskType}
        userId={user.id}
      />

      {task.subtasks.length > 0 && (
        <section className="section" style={{ marginTop: "2rem" }}>
          <h2>{zh ? "子任务" : "Subtasks"}</h2>
          <ol className="list">
            {task.subtasks.map((sub) => (
              <li className="list-item" key={sub.id}>
                <a href={`/${params.locale}/activities/${params.slug}/tasks/${sub.id}`}>{sub.title}</a>
                <span className="chip chip" style={{ marginLeft: "0.5rem" }}>{sub.taskType}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
