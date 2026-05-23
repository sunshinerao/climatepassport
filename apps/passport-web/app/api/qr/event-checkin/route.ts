import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getEventCheckinQrExpiry, issueQrToken } from "@/lib/server/qr";

const requestSchema = z.object({
  eventId: z.string().uuid(),
});

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = requestSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const registration = await prisma.registration.findUnique({
    where: {
      userId_eventId: {
        userId: user.id,
        eventId: payload.data.eventId,
      },
    },
    select: {
      id: true,
      status: true,
      checkedInAt: true,
    },
  });

  if (!registration || !["REGISTERED", "ATTENDED"].includes(registration.status)) {
    return NextResponse.json({ error: "No eligible registration found for this event." }, { status: 403 });
  }

  const qr = await issueQrToken({
    type: "EVENT_CHECKIN",
    userId: user.id,
    eventId: payload.data.eventId,
    subjectType: "registration",
    subjectId: registration.id,
    expiresAt: getEventCheckinQrExpiry(),
    scopeJson: {
      actions: ["event_checkin"],
    },
  });

  return NextResponse.json({
    ok: true,
    qr: {
      token: qr.token,
      type: qr.type,
      expiresAt: qr.expiresAt?.toISOString() ?? null,
    },
  });
}
