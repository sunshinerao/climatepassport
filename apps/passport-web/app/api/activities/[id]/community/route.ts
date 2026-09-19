import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { canModerateActivityCommunity, isCommunityActivity, validateCommunityText } from "@/lib/server/activity-community";
import { checkRateLimitAsync, getRateLimitHeaders, getRateLimitSubjectReference } from "@/lib/server/rate-limit";
import { writeCoreAuditLog } from "@/lib/server/audit";

async function access(id: string) {
  const user = await getCurrentUser(); const prisma = getPrismaClient();
  if (!user || !prisma) return { user, prisma, response: NextResponse.json({ error: user ? "Database unavailable" : "Authentication required" }, { status: user ? 503 : 401 }) };
  const activity = await prisma.activity.findUnique({ where: { id }, select: { id: true, type: true, organizerUserId: true } });
  if (!activity || !isCommunityActivity(activity)) return { user, prisma, response: NextResponse.json({ error: "Community not available" }, { status: 404 }) };
  const community = await prisma.activityCommunity.findUnique({ where: { activityId: id } });
  if (!community) return { user, prisma, response: NextResponse.json({ error: "Community not enabled" }, { status: 404 }) };
  const moderator = await canModerateActivityCommunity(user, activity, community.id);
  const participation = await prisma.activityParticipation.findUnique({ where: { activityId_userId: { activityId: id, userId: user.id } }, select: { id: true } });
  if (!moderator && !participation) return { user, prisma, response: NextResponse.json({ error: "Participant access required" }, { status: 403 }) };
  return { user, prisma, activity, community, moderator };
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await access(params.id); if ("response" in ctx) return ctx.response;
  const posts = await ctx.prisma.activityCommunityPost.findMany({ where: { communityId: ctx.community.id, OR: [{ status: "PUBLISHED" }, { authorUserId: ctx.user.id }, ...(ctx.moderator ? [{}] : [])] }, include: { author: { select: { id: true, name: true, avatar: true } }, comments: { where: ctx.moderator ? {} : { OR: [{ status: "PUBLISHED" }, { authorUserId: ctx.user.id }] }, include: { author: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ community: { id: ctx.community.id, mode: ctx.community.mode }, posts });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await access(params.id); if ("response" in ctx) return ctx.response;
  if (ctx.community.mode !== "OPEN" && !ctx.moderator) return NextResponse.json({ error: "Community is read-only" }, { status: 403 });
  const limit = await checkRateLimitAsync(`community-post:${getRateLimitSubjectReference(ctx.user.id)}`, { limit: 8, windowMs: 60_000, sensitive: true });
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: getRateLimitHeaders(limit) });
  const body = await request.json().catch(() => null); const text = validateCommunityText(body?.body);
  if (!text || !["UPDATE", "DISCUSSION"].includes(body?.kind)) return NextResponse.json({ error: "Plain text without personal contact information is required" }, { status: 400 });
  const immediate = ctx.moderator;
  const post = await ctx.prisma.activityCommunityPost.create({ data: { communityId: ctx.community.id, authorUserId: ctx.user.id, kind: body.kind, body: text, status: immediate ? "PUBLISHED" : "PENDING", publishedAt: immediate ? new Date() : null } });
  await writeCoreAuditLog({ actorUserId: ctx.user.id, action: "ACTIVITY_COMMUNITY_POST_CREATED", subjectType: "ActivityCommunityPost", subjectId: post.id, result: post.status, metadataJson: { activityId: params.id, kind: post.kind } });
  return NextResponse.json({ post }, { status: 201 });
}
