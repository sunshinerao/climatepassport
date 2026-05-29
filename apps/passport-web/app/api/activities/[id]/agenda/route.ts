import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { z } from "zod";

const createAgendaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().optional(),
  description: z.string().trim().optional(),
  descriptionEn: z.string().trim().optional(),
  agendaDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  type: z.string().default("session"),
  venue: z.string().optional(),
  venueEn: z.string().optional(),
  moderatorId: z.string().optional(),
  speakerIds: z.array(z.string()).optional(),
  order: z.number().int().default(0),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const items = await prisma.activityAgendaItem.findMany({
    where: { activityId: params.id },
    include: {
      moderator: {
        select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
      },
      speakers: {
        orderBy: { order: "asc" },
        include: {
          speaker: {
            select: { id: true, name: true, nameEn: true, title: true, titleEn: true, organization: true, organizationEn: true, avatar: true },
          },
        },
      },
    },
    orderBy: [{ agendaDate: "asc" }, { startTime: "asc" }, { order: "asc" }],
  });

  return NextResponse.json({ agendaItems: items });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const parsed = createAgendaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;

  // Validate activity exists
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

  const item = await prisma.activityAgendaItem.create({
    data: {
      activityId: params.id,
      agendaDate: new Date(data.agendaDate),
      startTime: data.startTime,
      endTime: data.endTime,
      title: data.title,
      titleEn: data.titleEn || null,
      description: data.description || null,
      descriptionEn: data.descriptionEn || null,
      type: data.type,
      venue: data.venue || null,
      venueEn: data.venueEn || null,
      moderatorId: data.moderatorId || null,
      order: data.order,
    },
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

  // Link speakers if provided
  if (data.speakerIds && data.speakerIds.length > 0) {
    await prisma.activityAgendaItemSpeaker.createMany({
      data: data.speakerIds.map((speakerId, index) => ({
        agendaItemId: item.id,
        speakerId,
        order: index,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true, agendaItem: item });
}
