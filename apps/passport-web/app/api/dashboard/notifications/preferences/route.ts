import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiUser } from "@/lib/server/api-auth";

const preferenceSchema = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  marketingEnabled: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = preferenceSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const preference = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: payload.data,
    create: {
      userId: user.id,
      ...payload.data,
    },
  });

  return NextResponse.json({ ok: true, preference });
}
