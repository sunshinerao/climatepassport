import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { validateCommunityText } from "@/lib/server/activity-community";
import { checkRateLimitAsync, getRateLimitHeaders, getRateLimitSubjectReference } from "@/lib/server/rate-limit";
import { writeCoreAuditLog } from "@/lib/server/audit";

export async function POST(request: NextRequest, { params }: { params: { id: string; postId: string } }) {
  const user = await getCurrentUser(); const prisma = getPrismaClient(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const participant = await prisma.activityParticipation.findUnique({ where: { activityId_userId: { activityId: params.id, userId: user.id } }, select: { id: true } }); if (!participant && user.role !== "ADMIN") return NextResponse.json({ error: "Participant access required" }, { status: 403 });
  const payload = await request.json().catch(() => null); const commentId = typeof payload?.commentId === "string" ? payload.commentId : null;
  const post = await prisma.activityCommunityPost.findFirst({ where: { id: params.postId, community: { activityId: params.id } }, select: { id: true } }); if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (commentId && !await prisma.activityCommunityComment.findFirst({ where: { id: commentId, postId: post.id }, select: { id: true } })) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  const limit = await checkRateLimitAsync(`community-report:${getRateLimitSubjectReference(user.id)}`, { limit: 6, windowMs: 60_000, sensitive: true }); if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: getRateLimitHeaders(limit) });
  const reason = validateCommunityText(payload?.reason, 500); if (!reason) return NextResponse.json({ error: "A plain-text reason is required" }, { status: 400 });
  try { const report = await prisma.activityCommunityReport.create({ data: { reporterUserId: user.id, ...(commentId ? { commentId } : { postId: post.id }), reason } }); await writeCoreAuditLog({ actorUserId: user.id, action: "ACTIVITY_COMMUNITY_REPORTED", subjectType: commentId ? "ActivityCommunityComment" : "ActivityCommunityPost", subjectId: commentId ?? post.id, result: "CREATED", metadataJson: { activityId: params.id } }); return NextResponse.json({ report: { id: report.id } }, { status: 201 }); } catch { return NextResponse.json({ error: "Already reported" }, { status: 409 }); }
}
