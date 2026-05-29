import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const speakers = await prisma.activitySpeaker.findMany({
    where: { activityId: params.id },
    include: {
      speaker: {
        select: {
          id: true,
          name: true,
          nameEn: true,
          title: true,
          titleEn: true,
          organization: true,
          organizationEn: true,
          bio: true,
          bioEn: true,
          avatar: true,
        },
      },
    },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ speakers });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const speakerId = body.speakerId as string | undefined;
  const role = body.role as string | undefined;
  const roleEn = body.roleEn as string | undefined;
  const order = typeof body.order === "number" ? body.order : 0;

  if (!speakerId) {
    return NextResponse.json({ error: "speakerId is required" }, { status: 400 });
  }

  const existing = await prisma.activitySpeaker.findUnique({
    where: {
      activityId_speakerId: {
        activityId: params.id,
        speakerId,
      },
    },
  });

  if (existing) {
    const updated = await prisma.activitySpeaker.update({
      where: { id: existing.id },
      data: {
        role: role !== undefined ? role : existing.role,
        roleEn: roleEn !== undefined ? roleEn : existing.roleEn,
        order: order !== undefined ? order : existing.order,
      },
      include: {
        speaker: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            title: true,
            titleEn: true,
            organization: true,
            organizationEn: true,
            avatar: true,
          },
        },
      },
    });
    return NextResponse.json({ ok: true, speaker: updated });
  }

  const link = await prisma.activitySpeaker.create({
    data: {
      activityId: params.id,
      speakerId,
      role: role || null,
      roleEn: roleEn || null,
      order,
    },
    include: {
      speaker: {
        select: {
          id: true,
          name: true,
          nameEn: true,
          title: true,
          titleEn: true,
          organization: true,
          organizationEn: true,
          avatar: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, speaker: link });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const speakerId = searchParams.get("speakerId");

  if (!speakerId) {
    return NextResponse.json({ error: "speakerId is required" }, { status: 400 });
  }

  const existing = await prisma.activitySpeaker.findUnique({
    where: {
      activityId_speakerId: {
        activityId: params.id,
        speakerId,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Speaker link not found" }, { status: 404 });
  }

  await prisma.activitySpeaker.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
