import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { readControlledAsset } from "@/lib/server/controlled-assets";

// CP-TODO-248：受控资产元数据端点 —— GET 读取资产信息（不含字节）；
// 所有者，或经由证据版本绑定到可读记录/衍生链继承可读（CP-FR-058）。

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const result = await readControlledAsset(prisma, { assetId: params.id, actorUserId: session.user.id });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 200 });
}
