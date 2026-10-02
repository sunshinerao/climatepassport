import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { canModerateActivityCommunity, isCommunityActivity, validateCommunityText } from "@/lib/server/activity-community";
import { checkRateLimitAsync, getRateLimitHeaders, getRateLimitSubjectReference } from "@/lib/server/rate-limit";
import { writeCoreAuditLog } from "@/lib/server/audit";

export async function POST(request: NextRequest, { params }: { params: { id: string; postId: string } }) {
  const user = await getCurrentUser(); const prisma = getPrismaClient();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const activity = await prisma.activity.findUnique({ where: { id: params.id }, select: { type: true, organizerUserId: true } });
  const community = await prisma.activityCommunity.findUnique({ where: { activityId: params.id } });
  if (!activity || !community || !isCommunityActivity(activity)) return NextResponse.json({ error: "Community not available" }, { status: 404 });
  const moderator = await canModerateActivityCommunity(user, activity, community.id);
  const participant = await prisma.activityParticipation.findUnique({ where: { activityId_userId: { activityId: params.id, userId: user.id } }, select: { id: true } });
  if (!moderator && !participant) return NextResponse.json({ error: "Participant access required" }, { status: 403 });
  if (community.mode !== "OPEN" && !moderator) return NextResponse.json({ error: "Community is read-only" }, { status: 403 });
  const post = await prisma.activityCommunityPost.findFirst({ where: { id: params.postId, communityId: community.id, ...(moderator ? {} : { OR: [{ status: "PUBLISHED" }, { authorUserId: user.id }] }) }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const limit = await checkRateLimitAsync(`community-comment:${getRateLimitSubjectReference(user.id)}`, { limit: 16, windowMs: 60_000, sensitive: true });
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: getRateLimitHeaders(limit) });
  const input = await request.json().catch(() => null); const body = validateCommunityText(input?.body);
  if (!body) return NextResponse.json({ error: "Plain text without personal contact information is required" }, { status: 400 });
  const status = moderator ? "PUBLISHED" : "PENDING";
  const comment = await prisma.activityCommunityComment.create({ data: { postId: post.id, authorUserId: user.id, body, status, publishedAt: moderator ? new Date() : null } });
  await writeCoreAuditLog({ actorUserId: user.id, action: "ACTIVITY_COMMUNITY_COMMENT_CREATED", subjectType: "ActivityCommunityComment", subjectId: comment.id, result: status, metadataJson: { activityId: params.id, postId: post.id } });
  return NextResponse.json({ comment }, { status: 201 });
}
