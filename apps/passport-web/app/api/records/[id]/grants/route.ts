import { NextRequest, NextResponse } from "next/server";
import { RecordGrantSchema } from "@climate-passport/passport-contracts";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { grantRecordAccess } from "@/lib/server/private-records";

// CP-TODO-247：记录协作授权端点 —— POST 授予对象级访问（限定对象/动作/用途/有效期，
// 仅记录所有者或 Programme manage，CP-FR-071）。

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = RecordGrantSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { validFrom, validUntil, ...grant } = parsed.data;
  const result = await grantRecordAccess(prisma, {
    recordId: params.id,
    actorUserId: session.user.id,
    ...grant,
    validFrom: validFrom ? new Date(validFrom) : null,
    validUntil: validUntil ? new Date(validUntil) : null,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}
