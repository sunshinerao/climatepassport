import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get("activityId") ?? undefined;

  if (!activityId) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const tasks = await prisma.activityTask.findMany({
    where: { activityId },
    orderBy: [{ parentTaskId: "asc" }, { orderIndex: "asc" }],
    include: {
      subtasks: { orderBy: { orderIndex: "asc" } },
      _count: { select: { submissions: true, checkinRecords: true } },
    },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const {
    activityId, parentTaskId, title, description, taskType,
    isRequired, startTime, dueTime, points, requiresSubmission,
    requiresCheckin, requiresReview, orderIndex, ruleJson,
    badgeTriggerDefinitionId,
  } = body;

  if (!activityId || !title || !taskType) {
    return NextResponse.json({ error: "Missing required fields: activityId, title, taskType" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const task = await prisma.activityTask.create({
    data: {
      activityId,
      parentTaskId,
      title,
      description,
      taskType,
      isRequired: isRequired ?? true,
      startTime: startTime ? new Date(startTime) : undefined,
      dueTime: dueTime ? new Date(dueTime) : undefined,
      points: points ?? 0,
      badgeTriggerDefinitionId,
      requiresSubmission: requiresSubmission ?? false,
      requiresCheckin: requiresCheckin ?? false,
      requiresReview: requiresReview ?? false,
      orderIndex: orderIndex ?? 0,
      ruleJson,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
