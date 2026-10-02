import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { requeueDeadDispatch } from "@/lib/server/reliable-dispatch";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-244：死信重投（compare-and-set，仅 DEAD 可重投）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const result = await requeueDeadDispatch(prisma, { id: params.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await prisma.coreAuditLog.create({
    data: {
      actorUserId: user.id,
      action: "outbound_dispatch.requeue",
      subjectType: "outbound_dispatch",
      subjectId: params.id,
      result: "requeued",
    },
  });
  return NextResponse.json(result, { status: 200 });
}
