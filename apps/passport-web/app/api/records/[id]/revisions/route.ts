import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { listRecordRevisions } from "@/lib/server/private-records";

// CP-TODO-247：记录修订历史端点 —— GET 返回只追加的不可变修订序列（CP-FR-057）。

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const result = await listRecordRevisions(prisma, { recordId: params.id, actorUserId: session.user.id });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 200 });
}
