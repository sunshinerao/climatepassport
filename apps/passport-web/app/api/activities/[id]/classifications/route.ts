import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { listActivityClassifications } from "@/lib/server/activity-taxonomy";

/** CP-TODO-246：活动的外部分类引用（公开读取 ACTIVE 版本投影；?includeWithdrawn=1 仅管理语境使用）。 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const includeWithdrawn = new URL(req.url).searchParams.get("includeWithdrawn") === "1";
  const { classifications } = await listActivityClassifications(prisma, params.id, { includeWithdrawn });
  return NextResponse.json({ classifications });
}
