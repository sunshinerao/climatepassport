import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-244：出站事件列表（过滤 status/eventType；不暴露 payload 之外的敏感面）。 */
export async function GET(req: NextRequest) {
  const apiAuth = await requireApiRole(["ADMIN"], req);
  if (apiAuth instanceof NextResponse) return apiAuth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const searchParams = new URL(req.url).searchParams;
  const status = searchParams.get("status");
  const eventType = searchParams.get("eventType");
  const dispatches = await prisma.outboundDispatch.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(eventType ? { eventType } : {}),
    },
    select: {
      id: true, eventType: true, idempotencyKey: true, revision: true, channelClientId: true,
      status: true, attempts: true, maxAttempts: true, nextRetryAt: true, lastError: true,
      receiptJson: true, deliveredAt: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ dispatches });
}
