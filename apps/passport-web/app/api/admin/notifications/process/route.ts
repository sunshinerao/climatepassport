import { NextRequest, NextResponse } from "next/server";
import { NotificationProcessSchema } from "@climate-passport/passport-contracts";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { processDueNotifications } from "@/lib/server/notification-delivery";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-257：批处理到期通知（重试/死信由服务决定），仅 ADMIN。 */
export async function POST(req: NextRequest) {
  const auth = await requireApiRole(["ADMIN"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = NotificationProcessSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const totals = await processDueNotifications(prisma, { limit: parsed.data.limit });
  await writeCoreAuditLog({
    actorUserId: auth.id,
    action: "NOTIFICATION_DELIVERY_PROCESS",
    subjectType: "Notification",
    subjectId: "batch",
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: totals,
  }).catch(() => undefined);

  return NextResponse.json(totals);
}
