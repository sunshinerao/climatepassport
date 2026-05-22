import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const actionSchema = z.object({
  action: z.enum(["mark_read", "archive"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/notifications");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = actionSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const existing = await prisma.notification.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }

  const notification = await prisma.notification.update({
    where: { id: params.id },
    data:
      payload.data.action === "mark_read"
        ? {
            status: "READ",
            readAt: new Date(),
          }
        : {
            status: "ARCHIVED",
          },
  });

  return NextResponse.json({ ok: true, notification });
}
