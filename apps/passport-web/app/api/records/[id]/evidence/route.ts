import { NextRequest, NextResponse } from "next/server";
import { EvidenceVersionCreateSchema } from "@climate-passport/passport-contracts";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { createEvidenceVersion } from "@/lib/server/controlled-assets";

// CP-TODO-248：记录证据版本端点 —— POST 创建不可变证据版本
//（绑定记录需 WRITE 权限，版本号单调递增，CP-FR-058）。

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = EvidenceVersionCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await createEvidenceVersion(prisma, {
    actorUserId: session.user.id,
    ...parsed.data,
    recordId: params.id,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}
