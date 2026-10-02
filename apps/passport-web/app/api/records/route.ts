import { NextRequest, NextResponse } from "next/server";
import { ScopedRecordCreateSchema } from "@climate-passport/passport-contracts";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { createScopedRecord, listScopedRecords } from "@/lib/server/private-records";

// CP-TODO-247：私密记录集合端点 —— POST 创建记录（首条不可变修订），
// GET 列出当前账号可见的记录（所有 + 被授权 + Programme 范围，CP-FR-057/071）。

export async function POST(req: NextRequest) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = ScopedRecordCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await createScopedRecord(prisma, {
    actorUserId: session.user.id,
    ...parsed.data,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}

export async function GET(req: NextRequest) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const recordType = searchParams.get("recordType");
  const programmeId = searchParams.get("programmeId");
  const result = await listScopedRecords(prisma, {
    actorUserId: session.user.id,
    ...(recordType ? { recordType } : {}),
    ...(programmeId ? { programmeId } : {}),
  });
  return NextResponse.json(result, { status: 200 });
}
