import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiRole } from "@/lib/server/api-auth";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const apiAuth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], _request);
  if (apiAuth instanceof NextResponse) return apiAuth;
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
