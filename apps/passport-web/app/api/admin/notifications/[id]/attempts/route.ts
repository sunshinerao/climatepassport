import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { listDeliveryAttempts } from "@/lib/server/notification-delivery";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-257：投递尝试记录（重试证据），仅 ADMIN。 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const notification = await prisma.notification.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!notification) return NextResponse.json({ error: "Notification not found", code: "NOTIFICATION_NOT_FOUND" }, { status: 404 });

  const { attempts } = await listDeliveryAttempts(prisma, params.id);
  return NextResponse.json({ attempts });
}
