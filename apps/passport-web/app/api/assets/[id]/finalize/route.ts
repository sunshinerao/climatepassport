import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { finalizeControlledAsset } from "@/lib/server/controlled-assets";

// CP-TODO-248：受控资产 finalize 端点 —— POST 回读校验完整性并运行扫描门禁；
// CLEAN → READY，INFECTED → QUARANTINED（CP-FR-058）。

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const result = await finalizeControlledAsset(prisma, { assetId: params.id, actorUserId: session.user.id });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 200 });
}
