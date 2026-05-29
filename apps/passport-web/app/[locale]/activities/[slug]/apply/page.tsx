import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";
import ActivityApplyClient from "@/components/activity-apply-client";

export default async function ActivityApplyPage({ params }: { params: { locale: Locale; slug: string } }) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/activities/${params.slug}/apply`);
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const zh = params.locale === "zh";

  const activity = await prisma.activity.findUnique({
    where: { slug: params.slug },
  });

  if (!activity || !["PUBLISHED", "ONGOING"].includes(activity.status)) {
    notFound();
  }

  // If registration window is closed
  const now = new Date();
  if (activity.registrationCloseAt && activity.registrationCloseAt < now) {
    redirect(`/${params.locale}/activities/${params.slug}`);
  }

  // Check if already applied or participating
  const [existing, participation] = await Promise.all([
    prisma.activityApplication.findUnique({
      where: { activityId_userId: { activityId: activity.id, userId: user.id } },
      select: { status: true },
    }),
    prisma.activityParticipation.findUnique({
      where: { activityId_userId: { activityId: activity.id, userId: user.id } },
      select: { status: true },
    }),
  ]);

  if (existing || participation) {
    redirect(`/${params.locale}/activities/${params.slug}`);
  }

  const formTemplate = null; // Form template fetched via ActivityRole if needed

  return (
    <main className="page page">
      <div className="section-header">
        <div >
          <a href={`/${params.locale}/activities`}>{zh ? "活动中心" : "Activities"}</a>
          <span aria-hidden="true"> / </span>
          <a href={`/${params.locale}/activities/${params.slug}`}>{zh ? activity.title : (activity.titleEn ?? activity.title)}</a>
          <span aria-hidden="true"> / </span>
          <span>{zh ? (activity.requiresApproval ? "申请参与" : "报名") : (activity.requiresApproval ? "Apply" : "Register")}</span>
        </div>
      </div>

      <div className="page">
        <ActivityApplyClient
          activityId={activity.id}
          activityTitle={zh ? activity.title : (activity.titleEn ?? activity.title)}
          formTemplate={null}
          locale={params.locale}
          requiresApproval={activity.requiresApproval}
          userId={user.id}
        />
      </div>
    </main>
  );
}
