import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { canModerateActivityCommunity, isCommunityActivity } from "@/lib/server/activity-community";
import { AdminActivityCommunityClient } from "@/components/admin-activity-community-client";
import type { Locale } from "@/lib/site-content";

export default async function Page({ params }: { params: { locale: Locale; id: string } }) {
  const prisma = getPrismaClient(); const user = await getCurrentUser();
  if (!prisma || !user) notFound();
  const activity = await prisma.activity.findUnique({ where: { id: params.id }, include: { community: { include: { posts: { where: { status: { not: "PUBLISHED" } }, include: { reports: true, comments: { where: { status: { not: "PUBLISHED" } }, include: { reports: true } } }, take: 100 } } } } });
  if (!activity || !isCommunityActivity(activity)) notFound();
  const allowed = activity.community ? await canModerateActivityCommunity(user, activity, activity.community.id) : user.role === "ADMIN" || activity.organizerUserId === user.id;
  if (!allowed) notFound();
  const posts = (activity.community?.posts ?? []).map((p) => ({ id: p.id, body: p.body, status: p.status, reports: p.reports.length, comments: p.comments.map((c) => ({ id: c.id, body: c.body, status: c.status, reports: c.reports.length })) }));
  return <main className="page"><div className="section-header"><a href={`/${params.locale}/admin/activities/${params.id}`}>‹ {params.locale === "zh" ? "活动详情" : "Activity detail"}</a><h1>{params.locale === "zh" ? "社区管理" : "Community moderation"}</h1></div><AdminActivityCommunityClient activityId={params.id} locale={params.locale} mode={activity.community?.mode ?? "CLOSED"} posts={posts} /></main>;
}
