import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
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
  const where = {
    ...(activityId ? { activityId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(status ? { status: status as any } : {}),
    ...(userId ? { userId } : {}),
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
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { userId, activityId, taskId, fileUrls, textContent, linkUrl, mediaType } = body;

  if (!userId || !activityId) {
    return NextResponse.json({ error: "Missing required fields: userId, activityId" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const submission = await prisma.activitySubmission.create({
    data: {
      userId,
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
