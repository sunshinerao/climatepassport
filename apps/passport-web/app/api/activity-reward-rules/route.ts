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
  const rules = await prisma.activityRewardRule.findMany({
    where: { activityId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { activityId, trigger, rewardType, rewardValueJson, conditionJson } = body;

  if (!activityId || !trigger || !rewardType || rewardValueJson === undefined) {
    return NextResponse.json({ error: "Missing required fields: activityId, trigger, rewardType, rewardValueJson" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const rule = await prisma.activityRewardRule.create({
    data: { activityId, trigger, rewardType, rewardValueJson, conditionJson },
  });

  return NextResponse.json({ rule }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  await prisma.activityRewardRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
