import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { canModerateActivityCommunity, isCommunityActivity } from "@/lib/server/activity-community";
import { writeCoreAuditLog } from "@/lib/server/audit";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(); const prisma = getPrismaClient(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const activity = await prisma.activity.findUnique({ where: { id: params.id }, select: { type: true, organizerUserId: true } }); if (!activity || !isCommunityActivity(activity)) return NextResponse.json({ error: "Community is only available for projects and challenges" }, { status: 404 });
  let community = await prisma.activityCommunity.findUnique({ where: { activityId: params.id } });
  // A community may only be enabled by an admin or the exact organizer; EVENT_MANAGER is never enough.
  if (!community) { if (user.role !== "ADMIN" && activity.organizerUserId !== user.id) return NextResponse.json({ error: "Organizer or admin access required" }, { status: 403 }); community = await prisma.activityCommunity.create({ data: { activityId: params.id } }); }
  if (!(await canModerateActivityCommunity(user, activity, community.id))) return NextResponse.json({ error: "Moderator access required" }, { status: 403 });
  const body = await request.json().catch(() => null); if (!body || !["OPEN", "READ_ONLY", "CLOSED"].includes(body.mode)) return NextResponse.json({ error: "Invalid community mode" }, { status: 400 });
  const updated = await prisma.activityCommunity.update({ where: { id: community.id }, data: { mode: body.mode, premoderated: true } });
  await writeCoreAuditLog({ actorUserId: user.id, action: "ACTIVITY_COMMUNITY_SETTINGS_UPDATED", subjectType: "ActivityCommunity", subjectId: community.id, result: "SUCCESS", metadataJson: { activityId: params.id, mode: updated.mode } });
  return NextResponse.json({ community: updated });
}
