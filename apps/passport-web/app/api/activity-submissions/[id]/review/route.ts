import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { requireApiRole } from "@/lib/server/api-auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { status, reviewComment, score } = body;

  const validStatuses = ["APPROVED", "REJECTED", "REVISION_REQUIRED", "UNDER_REVIEW"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const existing = await prisma.activitySubmission.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
  if (!(await canManageActivity(prisma, auth, existing.activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const submission = await prisma.activitySubmission.update({
    where: { id: params.id },
    data: {
      status,
      reviewComment,
      reviewedByUserId: auth.id,
      ...(score !== undefined && { score }),
    },
  });

  if (status === "APPROVED") {
    await triggerActivityRewards({ activityId: existing.activityId, userId: existing.userId, trigger: "SUBMISSION_APPROVED" });
    // Also fire TASK_COMPLETED when this submission belongs to a specific task
    if (existing.taskId) {
      await triggerActivityRewards({ activityId: existing.activityId, userId: existing.userId, trigger: "TASK_COMPLETED" });
    }
  }

  return NextResponse.json({ submission });
}
