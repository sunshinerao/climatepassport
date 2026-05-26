import { NextResponse } from "next/server";
import { z } from "zod";
import {
  hashUserPassword,
  requireAuthenticatedUser,
  verifyUserPassword,
} from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function PATCH(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/profile");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = passwordSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });

  if (!account) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const currentPasswordOk = await verifyUserPassword(
    account.password,
    payload.data.currentPassword,
  );

  if (!currentPasswordOk) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  if (payload.data.currentPassword === payload.data.newPassword) {
    return NextResponse.json(
      { error: "New password must be different from the current password." },
      { status: 400 },
    );
  }

  const passwordHash = await hashUserPassword(payload.data.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return NextResponse.json({ ok: true });
}
