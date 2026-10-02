import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { requireApiRole } from "@/lib/server/api-auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { canManageActivity } from "@/lib/server/verifier-activity";

export async function GET(req: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get("activityId") ?? undefined;
  const taskId = searchParams.get("taskId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (activityId && !(await canManageActivity(prisma, auth, activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const where = {
    ...(activityId ? { activityId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(status ? { status: status as any } : {}),
    ...(userId ? { userId } : {}),
    ...(auth.role === "EVENT_MANAGER" ? { activity: { organizerUserId: auth.id } } : {}),
  };

  const [total, submissions] = await Promise.all([
    prisma.activitySubmission.count({ where }),
    prisma.activitySubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ submissions, total, page, limit });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { activityId, taskId, fileUrls, textContent, linkUrl, mediaType } = body;

  if (!activityId || !taskId) {
    return NextResponse.json({ error: "activityId and taskId are required" }, { status: 400 });
  }
  if (body.userId && body.userId !== user.id) {
    return NextResponse.json({ error: "Cannot submit work for another user." }, { status: 403 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const [task, participation] = await Promise.all([
    prisma.activityTask.findFirst({ where: { id: taskId, activityId, requiresSubmission: true }, select: { id: true } }),
    prisma.activityParticipation.findUnique({ where: { activityId_userId: { activityId, userId: user.id } }, select: { status: true } }),
  ]);
  if (!task) return NextResponse.json({ error: "Submission task not found." }, { status: 404 });
  if (!participation || !["ACCEPTED", "CHECKED_IN", "IN_PROGRESS"].includes(participation.status)) {
    return NextResponse.json({ error: "Active participation is required." }, { status: 403 });
  }
  const submission = await prisma.activitySubmission.create({
    data: {
      userId: user.id,
      activityId,
      taskId,
      fileUrls: fileUrls ?? [],
      textContent,
      linkUrl,
      mediaType,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ submission }, { status: 201 });
}
