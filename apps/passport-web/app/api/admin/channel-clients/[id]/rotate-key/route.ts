import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/server/prisma";
import { MACHINE_KEY_MAX_VALID_DAYS, rotateChannelClientKey } from "@/lib/server/channel-client-auth";
import { requireApiRole } from "@/lib/server/api-auth";

const rotateSchema = z.object({
  expiresInDays: z.number().int().min(1).max(MACHINE_KEY_MAX_VALID_DAYS).optional(),
  reason: z.string().trim().max(500).optional(),
});

/**
 * CP-TODO-243：轮换 machine key（ADMIN）。新机密立即覆盖旧机密，因此旧 key 当场失效；
 * 新明文只在本次响应出现一次。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = rotateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });

  const result = await rotateChannelClientKey(prisma, {
    id: params.id,
    actorUserId: user.id,
    expiresInDays: parsed.data.expiresInDays,
    reason: parsed.data.reason,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(
    {
      client: result.client,
      machineKey: result.machineKey,
      openApiKey: result.openApiKey,
      machineKeyExpiresAt: result.machineKeyExpiresAt,
      warning: "Store this key now; the previous one stops working immediately and this value is never returned again.",
    },
    { status: 200 },
  );
}
