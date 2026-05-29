import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { z } from "zod";

const updateAgendaSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  titleEn: z.string().trim().optional(),
  description: z.string().trim().optional(),
  descriptionEn: z.string().trim().optional(),
  agendaDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  type: z.string().optional(),
  venue: z.string().optional(),
  venueEn: z.string().optional(),
  moderatorId: z.string().optional().nullable(),
  speakerIds: z.array(z.string()).optional(),
  order: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; agendaId: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    select: { id: true, organizerUserId: true },
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  if (auth.role !== "ADMIN" && activity.organizerUserId !== auth.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updateAgendaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.titleEn !== undefined) updateData.titleEn = data.titleEn || null;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.descriptionEn !== undefined) updateData.descriptionEn = data.descriptionEn || null;
  if (data.agendaDate !== undefined) updateData.agendaDate = new Date(data.agendaDate);
  if (data.startTime !== undefined) updateData.startTime = data.startTime;
  if (data.endTime !== undefined) updateData.endTime = data.endTime;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.venue !== undefined) updateData.venue = data.venue || null;
  if (data.venueEn !== undefined) updateData.venueEn = data.venueEn || null;
  if (data.moderatorId !== undefined) updateData.moderatorId = data.moderatorId;
  if (data.order !== undefined) updateData.order = data.order;

  const item = await prisma.activityAgendaItem.update({
    where: { id: params.agendaId },
    data: updateData,
    include: {
      moderator: {
        select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
      },
      speakers: {
        include: {
          speaker: {
            select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
          },
        },
      },
    },
  });

  // Re-link speakers if provided
  if (data.speakerIds !== undefined) {
    await prisma.activityAgendaItemSpeaker.deleteMany({
      where: { agendaItemId: params.agendaId },
    });
    if (data.speakerIds.length > 0) {
      await prisma.activityAgendaItemSpeaker.createMany({
        data: data.speakerIds.map((speakerId, index) => ({
          agendaItemId: params.agendaId,
          speakerId,
          order: index,
        })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json({ ok: true, agendaItem: item });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; agendaId: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    select: { id: true, organizerUserId: true },
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  if (auth.role !== "ADMIN" && activity.organizerUserId !== auth.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.activityAgendaItem.delete({
    where: { id: params.agendaId },
  });

  return NextResponse.json({ ok: true });
}
