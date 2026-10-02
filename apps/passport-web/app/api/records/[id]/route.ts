import { NextRequest, NextResponse } from "next/server";
import { ScopedRecordUpdateSchema } from "@climate-passport/passport-contracts";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import {
  readScopedRecord,
  updateScopedRecord,
  withdrawScopedRecord,
} from "@/lib/server/private-records";

// CP-TODO-247：单条记录端点 —— GET 按对象级授权读取，PATCH compare-and-set
// 更新（冲突 409 不覆盖），DELETE 撤回（撤回后非所有者不可见，CP-FR-057/071）。

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const result = await readScopedRecord(prisma, { recordId: params.id, actorUserId: session.user.id });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = ScopedRecordUpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await updateScopedRecord(prisma, {
    recordId: params.id,
    actorUserId: session.user.id,
    ...parsed.data,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const result = await withdrawScopedRecord(prisma, { recordId: params.id, actorUserId: session.user.id });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 200 });
}
