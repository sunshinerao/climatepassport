import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const verifiers = await prisma.activityVerifier.findMany({
    where: { activityId: params.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ verifiers });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const userId = body.userId as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.role !== "VERIFIER" && targetUser.role !== "ADMIN" && targetUser.role !== "EVENT_MANAGER") {
    return NextResponse.json({ error: "Target user must have VERIFIER role or higher" }, { status: 400 });
  }

  const existing = await prisma.activityVerifier.findUnique({
    where: {
      userId_activityId: {
        userId,
        activityId: params.id,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Verifier already assigned" }, { status: 409 });
  }

  const verifier = await prisma.activityVerifier.create({
    data: {
      userId,
      activityId: params.id,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  return NextResponse.json({ ok: true, verifier });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const existing = await prisma.activityVerifier.findUnique({
    where: {
      userId_activityId: {
        userId,
        activityId: params.id,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Verifier not found" }, { status: 404 });
  }

  await prisma.activityVerifier.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
