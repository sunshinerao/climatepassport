import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { contributionStats } from "@/lib/server/contribution-facts";

/**
 * CP-TODO-253：派生统计（撤销可复算）。只返回 ACTIVE 事实的聚合量
 * （人数/条数/按人计量求和/等级分布），不返回任何个体行。
 */
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const stats = await contributionStats(prisma, {
    personId: searchParams.get("personId") ?? undefined,
    institutionId: searchParams.get("institutionId") ?? undefined,
    programmeId: searchParams.get("programmeId") ?? undefined,
  });
  return NextResponse.json(stats);
}
