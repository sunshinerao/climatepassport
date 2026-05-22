import { NextResponse } from "next/server";
import { adminEventSchema, buildEventWriteData, createEventSecret, serializeAdminEvent } from "@/lib/server/admin-events";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET() {
  const user = await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/events");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const events = await prisma.event.findMany({
    where: user.role === "ADMIN" ? undefined : { managerUserId: user.id },
    orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
    include: {
      manager: { select: { name: true } },
      _count: { select: { registrations: true } },
    },
  });

  return NextResponse.json({ events: events.map(serializeAdminEvent) });
}

export async function POST(request: Request) {
  const user = await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/events");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = adminEventSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid event payload." },
      { status: 400 },
    );
  }

  const managerUserId = user.role === "EVENT_MANAGER" ? user.id : payload.data.managerUserId ?? user.id;

  const event = await prisma.event.create({
    data: {
      ...buildEventWriteData(payload.data, managerUserId),
      venueCheckinSecret: createEventSecret(),
    },
    include: {
      manager: { select: { name: true } },
      _count: { select: { registrations: true } },
    },
  });

  return NextResponse.json({ ok: true, event: serializeAdminEvent(event) });
}
