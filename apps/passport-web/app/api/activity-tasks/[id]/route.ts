import { NextRequest, NextResponse } from "next/server";
import { ActivityTaskType } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { requireApiRole } from "@/lib/server/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], _req);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const task = await prisma.activityTask.findUnique({
    where: { id: params.id },
    include: {
      subtasks: { orderBy: { orderIndex: "asc" } },
      _count: { select: { submissions: true, checkinRecords: true } },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageActivity(prisma, auth, task.activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ task });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.activityTask.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageActivity(prisma, auth, existing.activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    title, description, taskType, isRequired, startTime, dueTime,
    points, requiresSubmission, requiresCheckin, requiresReview,
    orderIndex, ruleJson, badgeTriggerDefinitionId,
  } = body;

  if (taskType !== undefined && !(Object.values(ActivityTaskType) as string[]).includes(taskType)) {
    return NextResponse.json({ error: `Invalid taskType. Expected one of: ${Object.values(ActivityTaskType).join(", ")}` }, { status: 400 });
  }

  const task = await prisma.activityTask.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(taskType !== undefined ? { taskType } : {}),
      ...(isRequired !== undefined ? { isRequired } : {}),
      ...(startTime !== undefined ? { startTime: startTime ? new Date(startTime) : null } : {}),
      ...(dueTime !== undefined ? { dueTime: dueTime ? new Date(dueTime) : null } : {}),
      ...(points !== undefined ? { points } : {}),
      ...(requiresSubmission !== undefined ? { requiresSubmission } : {}),
      ...(requiresCheckin !== undefined ? { requiresCheckin } : {}),
      ...(requiresReview !== undefined ? { requiresReview } : {}),
      ...(orderIndex !== undefined ? { orderIndex } : {}),
      ...(ruleJson !== undefined ? { ruleJson } : {}),
      ...(badgeTriggerDefinitionId !== undefined ? { badgeTriggerDefinitionId } : {}),
    },
  });

  return NextResponse.json({ task });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], _req);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.activityTask.findUnique({
    where: { id: params.id },
    include: { _count: { select: { submissions: true, checkinRecords: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageActivity(prisma, auth, existing.activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (existing._count.submissions > 0 || existing._count.checkinRecords > 0) {
    return NextResponse.json(
      { error: "Cannot delete task with existing submissions or checkins" },
      { status: 409 }
    );
  }

  await prisma.activityTask.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
