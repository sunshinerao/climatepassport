import { NextRequest, NextResponse } from "next/server";
import { AssetRegisterSchema } from "@climate-passport/passport-contracts";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { registerControlledAsset } from "@/lib/server/controlled-assets";

// CP-TODO-248：受控资产集合端点 —— POST 登记资产（声明 fileName/contentType/
// byteSize/sha256，内容寻址存储键；上传字节与 finalize 另行完成，CP-FR-058）。

export async function POST(req: NextRequest) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = AssetRegisterSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await registerControlledAsset(prisma, {
    actorUserId: session.user.id,
    ...parsed.data,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}
