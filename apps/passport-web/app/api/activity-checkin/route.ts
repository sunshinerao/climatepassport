import { NextRequest, NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser, requireRoleAccess } from "@/lib/server/auth";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";
import { getPrismaClient } from "@/lib/server/prisma";
import { canManageActivity, canVerifyActivity } from "@/lib/server/verifier-activity";

const directCheckinMethods = new Set(["MANUAL", "GEO", "NFC", "FACIAL"]);

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get("activityId") ?? undefined;
  const taskId = searchParams.get("taskId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10)));

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (activityId && !(await canManageActivity(prisma, auth, activityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = {
    ...(activityId ? { activityId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(userId ? { userId } : {}),
    ...(status ? { status: status as any } : {}),
    ...(auth.role === "EVENT_MANAGER" ? { activity: { organizerUserId: auth.id } } : {}),
  };

  const [total, records] = await Promise.all([
    prisma.activityCheckinRecord.count({ where }),
    prisma.activityCheckinRecord.findMany({
      where,
      orderBy: { checkinAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ records, total, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const activityId = typeof body?.activityId === "string" ? body.activityId : null;
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const taskId = typeof body?.taskId === "string" && body.taskId ? body.taskId : null;
  const method = typeof body?.method === "string" ? body.method : null;
  if (!activityId || !userId || !method || !directCheckinMethods.has(method)) {
    return NextResponse.json({ error: "activityId, userId and a valid direct check-in method are required." }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const selfTaskCheckin = Boolean(taskId && auth.id === userId);
  if (!selfTaskCheckin && !["ADMIN", "EVENT_MANAGER", "VERIFIER"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!selfTaskCheckin && !(await canVerifyActivity(prisma, auth, activityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (taskId) {
    const task = await prisma.activityTask.findFirst({ where: { id: taskId, activityId, requiresCheckin: true }, select: { id: true } });
    if (!task) return NextResponse.json({ error: "Activity task not found." }, { status: 404 });
  }

  const participation = await prisma.activityParticipation.findUnique({
    where: { activityId_userId: { activityId, userId } },
    select: { id: true, status: true },
  });
  if (!participation) {
    return NextResponse.json({ error: "Participant is not registered for this activity." }, { status: 404 });
  }
  const eligible = taskId
    ? ["REGISTERED", "ACCEPTED", "CHECKED_IN", "IN_PROGRESS"]
    : ["REGISTERED", "ACCEPTED"];
  if (!eligible.includes(participation.status)) {
    const duplicate = !taskId && participation.status === "CHECKED_IN";
    return NextResponse.json(
      { status: duplicate ? "DUPLICATE" : "NOT_ELIGIBLE" },
      { status: duplicate ? 200 : 409 }
    );
  }

  const now = new Date();
  const outcome = await prisma.$transaction(async (tx) => {
    if (taskId) {
      const recent = await tx.activityCheckinRecord.findFirst({
        where: {
          activityId,
          userId,
          taskId,
          status: "VALID",
          checkinAt: { gte: new Date(now.getTime() - 5 * 60 * 1000) },
        },
        select: { id: true, checkinAt: true },
      });
      if (recent) return { status: "DUPLICATE" as const, record: recent, participationChanged: false };
    }

    let participationChanged = false;
    if (["REGISTERED", "ACCEPTED"].includes(participation.status)) {
      const updated = await tx.activityParticipation.updateMany({
        where: { id: participation.id, status: { in: ["REGISTERED", "ACCEPTED"] } },
        data: { status: "CHECKED_IN" },
      });
      if (updated.count !== 1) return null;
      participationChanged = true;
    }

    const record = await tx.activityCheckinRecord.create({
      data: {
        activityId,
        taskId,
        userId,
        method: method as any,
        status: "VALID",
        locationLat: typeof body?.locationLat === "number" ? body.locationLat : null,
        locationLng: typeof body?.locationLng === "number" ? body.locationLng : null,
        locationJson: body?.locationJson && typeof body.locationJson === "object" ? body.locationJson as any : undefined,
        verifiedByUserId: auth.id,
        checkinAt: now,
      },
    });
    return { status: "VALID" as const, record, participationChanged };
  }, { isolationLevel: "Serializable" });

  if (!outcome) {
    return NextResponse.json({ status: "DUPLICATE" });
  }

  if (outcome.status === "VALID" && outcome.participationChanged) {
    await triggerActivityRewards({ activityId, userId, trigger: "CHECKIN_COMPLETED" });
  }

  await writeCoreAuditLog({
    actorUserId: auth.id,
    action: "ACTIVITY_DIRECT_CHECKIN",
    subjectType: "ActivityParticipation",
    subjectId: participation.id,
    result: outcome.status,
    metadataJson: { activityId, taskId, method },
    ...getRequestAuditContext(req),
  });

  return NextResponse.json({ record: outcome.record, status: outcome.status }, { status: outcome.status === "VALID" ? 201 : 200 });
}
