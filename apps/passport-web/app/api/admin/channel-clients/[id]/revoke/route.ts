import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/server/prisma";
import { revokeChannelClient } from "@/lib/server/channel-client-auth";
import { requireApiRole } from "@/lib/server/api-auth";

const revokeSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/** CP-TODO-243：撤销渠道客户端（compare-and-set，撤销立即失效）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = revokeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const result = await revokeChannelClient(prisma, { id: params.id, actorUserId: user.id, reason: parsed.data.reason });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(result, { status: 200 });
}
