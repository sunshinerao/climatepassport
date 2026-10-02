import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/server/prisma";
import { mergeInstitutionRecords } from "@/lib/server/person-institution-governance";
import { requireApiRole } from "@/lib/server/api-auth";

const mergeSchema = z.object({
  sourceId: z.string().uuid(),
});

/** CP-TODO-242：合并 Institution 重复记录（ADMIN 后台治理；别名并入、引用迁移）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN"], req);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = mergeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "sourceId (uuid) is required." }, { status: 400 });

  const result = await mergeInstitutionRecords(prisma, {
    targetId: params.id,
    sourceId: parsed.data.sourceId,
    actorUserId: auth.id,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(result, { status: 200 });
}
