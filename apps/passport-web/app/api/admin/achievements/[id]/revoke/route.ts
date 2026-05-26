import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/achievements");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const achievement = await prisma.achievement.update({
    where: { id: params.id },
    data: {
      status: "REVOKED",
      isBadgeEligible: false,
      validatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, achievement });
}
