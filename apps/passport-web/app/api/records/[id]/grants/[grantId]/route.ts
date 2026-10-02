import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { revokeRecordAccess } from "@/lib/server/private-records";

// CP-TODO-247：撤销记录协作授权端点 —— DELETE 立即生效（compare-and-set，CP-FR-071）。

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; grantId: string } },
) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const result = await revokeRecordAccess(prisma, {
    grantId: params.grantId,
    actorUserId: session.user.id,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 200 });
}
