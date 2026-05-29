import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = { activityId: params.id };

  if (status) {
    where.status = status;
  }

  if (search) {
    const searchLower = search.toLowerCase();
    where.OR = [
      {
        user: {
          name: { contains: searchLower, mode: "insensitive" },
        },
      },
      {
        user: {
          email: { contains: searchLower, mode: "insensitive" },
        },
      },
    ];
  }

  const [applications, stats, users] = await Promise.all([
    prisma.activityApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityApplication.groupBy({
      by: ["status"],
      where: { activityId: params.id },
      _count: { status: true },
    }),
    prisma.user.findMany({
      where: {},
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        climatePassportId: true,
      },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const applicationsWithUser = applications.map((app) => ({
    ...app,
    user: userMap.get(app.userId) ?? null,
  }));

  const approvedCount =
    stats.find((s) => s.status === "APPROVED")?._count.status ?? 0;

  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    select: { capacity: true },
  });

  return NextResponse.json({
    applications: applicationsWithUser,
    stats: {
      approvedCount,
      capacity: activity?.capacity ?? null,
      byStatus: stats.reduce(
        (acc, s) => {
          acc[s.status] = s._count.status;
          return acc;
        },
        {} as Record<string, number>
      ),
    },
  });
}
