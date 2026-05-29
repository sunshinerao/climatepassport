import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const activityId = searchParams.get("activityId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const where = {
    ...(activityId ? { activityId } : {}),
    ...(status ? { status: status as any } : {}),
    ...(userId ? { userId } : {}),
  };

  const [total, applications] = await Promise.all([
    prisma.activityApplication.count({ where }),
    prisma.activityApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        activity: { select: { id: true, title: true, type: true, status: true } },
      },
    }),
  ]);

  return NextResponse.json({ applications, total, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { activityId, userId, roleType, formResponseJson } = body;

  if (!activityId || !userId) {
    return NextResponse.json({ error: "Missing required fields: activityId, userId" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.activityApplication.findUnique({
    where: { activityId_userId: { activityId, userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Application already exists for this user and activity" }, { status: 409 });
  }

  const application = await prisma.activityApplication.create({
    data: {
      activityId,
      userId,
      roleType,
      formResponseJson,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ application }, { status: 201 });
}
