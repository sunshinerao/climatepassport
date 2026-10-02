import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/server/prisma";
import { quarantineControlledAsset } from "@/lib/server/controlled-assets";
import { requireApiRole } from "@/lib/server/api-auth";

// CP-TODO-248：管理员资产检疫端点 —— POST 将受控资产立即标记为扫描失败并隔离（CP-FR-058）。

const quarantineSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = quarantineSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await quarantineControlledAsset(prisma, {
    assetId: params.id,
    actorUserId: user.id,
    reason: parsed.data.reason,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 200 });
}
