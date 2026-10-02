import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/server/prisma";
import { mergePersonRecords } from "@/lib/server/person-institution-governance";
import { requireApiRole } from "@/lib/server/api-auth";

const mergeSchema = z.object({
  sourceId: z.string().uuid(),
});

/** CP-TODO-242：合并 Person 重复记录（ADMIN 后台治理；源记录保留为可解析别名）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN"], req);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = mergeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "sourceId (uuid) is required." }, { status: 400 });

  const result = await mergePersonRecords(prisma, {
    targetId: params.id,
    sourceId: parsed.data.sourceId,
    actorUserId: auth.id,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(result, { status: 200 });
}
