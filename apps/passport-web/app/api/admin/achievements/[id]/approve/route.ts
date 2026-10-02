import { NextResponse } from "next/server";
import { evaluateBadgesForUser } from "@/lib/server/achievement-badge";
import { grantUserPoints } from "@/lib/server/point-ledger";
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
      status: "APPROVED",
      validatedAt: new Date(),
    },
    select: {
      id: true,
      userId: true,
      points: true,
    },
  });

  if (achievement.points > 0) {
    await grantUserPoints({
      client: prisma,
      userId: achievement.userId,
      points: achievement.points,
      type: "ACHIEVEMENT_REWARD",
      description: `Achievement reward: ${achievement.id}`,
      idempotencyKey: `achievement:${achievement.id}`,
    });
  }

  await evaluateBadgesForUser(achievement.userId);

  return NextResponse.json({ ok: true, achievement });
}
