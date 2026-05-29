import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get("activityId");
  if (!activityId) return NextResponse.json({ error: "activityId is required" }, { status: 400 });

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const milestones = await prisma.projectMilestone.findMany({
    where: { activityId },
    include: { deliverables: true },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json({ milestones });
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { activityId, title, description, dueDate, orderIndex } = body;

  if (!activityId || !title) {
    return NextResponse.json({ error: "activityId and title are required" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const milestone = await prisma.projectMilestone.create({
    data: {
      activityId,
      title,
      description: description ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      orderIndex: typeof orderIndex === "number" ? orderIndex : 0,
    },
  });

  return NextResponse.json({ milestone }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const body = await req.json();
  const { title, description, dueDate, status, orderIndex } = body;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const milestone = await prisma.projectMilestone.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(status !== undefined && { status }),
      ...(orderIndex !== undefined && { orderIndex }),
    },
  });

  return NextResponse.json({ milestone });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  await prisma.projectMilestone.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
