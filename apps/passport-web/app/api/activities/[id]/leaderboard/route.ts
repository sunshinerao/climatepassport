import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const period = searchParams.get("period") ?? "ALL_TIME"; // ALL_TIME | WEEKLY | MONTHLY
  const dimension = searchParams.get("dimension") ?? "INDIVIDUAL"; // INDIVIDUAL only for now (P3.1)

  // Check activity exists
  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, slug: true, type: true, status: true },
  });

  if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });

  // Build date filter for period
  let dateFilter: { updatedAt?: { gte: Date } } = {};
  if (period === "WEEKLY") {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    dateFilter = { updatedAt: { gte: since } };
  } else if (period === "MONTHLY") {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    dateFilter = { updatedAt: { gte: since } };
  }

  // Fetch top participations by pointsEarned
  const participations = await prisma.activityParticipation.findMany({
    where: {
      activityId: params.id,
      status: { in: ["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CERTIFIED"] },
      ...dateFilter,
    },
    orderBy: { pointsEarned: "desc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      pointsEarned: true,
      badgeAwardIds: true,
      status: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  if (participations.length === 0) {
    return NextResponse.json({ leaderboard: [], activity, dimension, period, total: 0 });
  }

  // Batch-fetch users
  const userIds = participations.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      climatePassportId: true,
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Merge and rank
  const leaderboard = participations.map((p, index) => {
    const user = userMap.get(p.userId);
    return {
      rank: index + 1,
      userId: p.userId,
      participationId: p.id,
      name: user?.name ?? "—",
      climatePassportId: user?.climatePassportId ?? null,
      pointsEarned: p.pointsEarned,
      badgeCount: p.badgeAwardIds.length,
      status: p.status,
      completedAt: p.completedAt,
    };
  });

  return NextResponse.json({
    leaderboard,
    activity,
    dimension,
    period,
    total: leaderboard.length,
  });
}
