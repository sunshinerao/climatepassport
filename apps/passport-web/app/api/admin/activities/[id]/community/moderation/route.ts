import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { canModerateActivityCommunity } from "@/lib/server/activity-community";
import { validateCommunityText } from "@/lib/server/activity-community";
import { writeCoreAuditLog } from "@/lib/server/audit";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(); const prisma = getPrismaClient(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const activity = await prisma.activity.findUnique({ where: { id: params.id }, select: { type: true, organizerUserId: true } }); const community = await prisma.activityCommunity.findUnique({ where: { activityId: params.id } });
  if (!activity || !community || !(await canModerateActivityCommunity(user, activity, community.id))) return NextResponse.json({ error: "Moderator access required" }, { status: 403 });
  const body = await request.json().catch(() => null); const reason = validateCommunityText(body?.reason, 500); if (!body || !reason || !["PUBLISHED", "REJECTED", "HIDDEN"].includes(body.status) || !["post", "comment"].includes(body.targetType) || typeof body.targetId !== "string") return NextResponse.json({ error: "A plain-text moderation reason is required" }, { status: 400 });
  const now = body.status === "PUBLISHED" ? new Date() : null;
  const target = body.targetType === "post" ? await prisma.activityCommunityPost.updateMany({ where: { id: body.targetId, communityId: community.id }, data: { status: body.status, publishedAt: now } }) : await prisma.activityCommunityComment.updateMany({ where: { id: body.targetId, post: { communityId: community.id } }, data: { status: body.status, publishedAt: now } });
  if (!target.count) return NextResponse.json({ error: "Content not found" }, { status: 404 });
  await writeCoreAuditLog({ actorUserId: user.id, action: "ACTIVITY_COMMUNITY_CONTENT_MODERATED", subjectType: body.targetType, subjectId: body.targetId, result: body.status, metadataJson: { activityId: params.id } });
  return NextResponse.json({ success: true });
}
