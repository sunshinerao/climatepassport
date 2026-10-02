import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ChannelScopeSchema } from "@climate-passport/passport-contracts";
import { getPrismaClient } from "@/lib/server/prisma";
import { RATE_LIMIT_BOUNDS, updateChannelClient } from "@/lib/server/channel-client-auth";
import { requireApiRole } from "@/lib/server/api-auth";

const updateSchema = z.object({
  displayName: z.string().trim().min(2).max(160).optional(),
  allowedOrigins: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  allowedIps: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  allowedScopes: z.array(ChannelScopeSchema).min(1).max(20).optional(),
  rateLimitLimit: z.number().int().min(RATE_LIMIT_BOUNDS.minLimit).max(RATE_LIMIT_BOUNDS.maxLimit).nullable().optional(),
  rateLimitWindowMs: z.number().int().min(RATE_LIMIT_BOUNDS.minWindowMs).max(RATE_LIMIT_BOUNDS.maxWindowMs).nullable().optional(),
});

/** CP-TODO-243：更新渠道客户端的展示名/allowlist/scopes/配额（key、type、programme 不可变）。 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });

  const result = await updateChannelClient(prisma, { ...parsed.data, id: params.id, actorUserId: user.id });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(result, { status: 200 });
}
