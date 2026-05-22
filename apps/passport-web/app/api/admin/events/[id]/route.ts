import { NextResponse } from "next/server";
import { adminEventSchema, buildEventWriteData, serializeAdminEvent } from "@/lib/server/admin-events";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/events");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const existingEvent = await prisma.event.findUnique({
    where: { id: params.id },
    select: { id: true, managerUserId: true },
  });

  if (!existingEvent) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (user.role !== "ADMIN" && existingEvent.managerUserId !== user.id) {
    return NextResponse.json({ error: "You do not have access to this event." }, { status: 403 });
  }

  const payload = adminEventSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid event payload." },
      { status: 400 },
    );
  }

  const managerUserId = user.role === "EVENT_MANAGER" ? user.id : payload.data.managerUserId ?? existingEvent.managerUserId ?? user.id;

  const event = await prisma.event.update({
    where: { id: params.id },
    data: buildEventWriteData(payload.data, managerUserId),
    include: {
      manager: { select: { name: true } },
      _count: { select: { registrations: true } },
    },
  });

  return NextResponse.json({ ok: true, event: serializeAdminEvent(event) });
}
