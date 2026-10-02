import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/server/prisma";
import { processOutboundDispatches } from "@/lib/server/reliable-dispatch";
import { requireApiRole } from "@/lib/server/api-auth";

const processSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** CP-TODO-244：处理到期的出站事件（租约 CAS + 退避 + 死信）。 */
export async function POST(req: NextRequest) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = processSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const summary = await processOutboundDispatches(prisma, { limit: parsed.data.limit });
  return NextResponse.json({ summary }, { status: 200 });
}
