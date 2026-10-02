import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/server/prisma";
import { reconcileOutboundDispatch } from "@/lib/server/reliable-dispatch";
import { requireApiRole } from "@/lib/server/api-auth";

const reconcileSchema = z.object({
  receipt: z.record(z.string(), z.unknown()),
  revision: z.coerce.number().int().min(1),
});

/** CP-TODO-244：接收方回执对账（幂等；旧 revision 拒绝，旧事件不能覆盖新状态）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = reconcileSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "receipt and revision are required." }, { status: 400 });

  const result = await reconcileOutboundDispatch(prisma, { id: params.id, receipt: parsed.data.receipt, revision: parsed.data.revision });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await prisma.coreAuditLog.create({
    data: {
      actorUserId: user.id,
      action: "outbound_dispatch.reconcile",
      subjectType: "outbound_dispatch",
      subjectId: params.id,
      result: result.applied ? "reconciled" : "already_matched",
      metadataJson: { revision: parsed.data.revision },
    },
  });
  return NextResponse.json(result, { status: 200 });
}
