import { NextResponse } from "next/server";
import { z } from "zod";
import { revokeBadgeAward } from "@/lib/server/achievement-badge";
import { requireApiRole } from "@/lib/server/api-auth";

const payloadSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const apiAuth = await requireApiRole(["ADMIN"], request);
  if (apiAuth instanceof NextResponse) return apiAuth;

  const payload = payloadSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const award = await revokeBadgeAward({
    awardId: params.id,
    reason: payload.data.reason,
  });

  return NextResponse.json({ ok: true, award });
}
