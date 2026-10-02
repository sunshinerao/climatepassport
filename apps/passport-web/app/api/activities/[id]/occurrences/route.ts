import { NextRequest, NextResponse } from "next/server";
import { ActivityOccurrenceInputSchema } from "@climate-passport/passport-contracts";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { createOccurrence, listOccurrences } from "@/lib/server/activity-occurrences";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-246：期次列表（公开可见未取消期次；管理者可用 ?includeCancelled=1 查看全部）。 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const includeCancelled = new URL(req.url).searchParams.get("includeCancelled") === "1";
  const { occurrences } = await listOccurrences(prisma, params.id, { includeCancelled });
  return NextResponse.json({ occurrences });
}

/** CP-TODO-246：创建期次（活动管理者）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (!(await canManageActivity(prisma, auth, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = ActivityOccurrenceInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await createOccurrence(prisma, {
    activityId: params.id,
    startsAt: new Date(parsed.data.startsAt),
    endsAt: new Date(parsed.data.endsAt),
    capacity: parsed.data.capacity,
    locationJson: parsed.data.locationJson ?? null,
    status: parsed.data.status,
  });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  await writeCoreAuditLog({
    actorUserId: auth.id,
    action: "ACTIVITY_OCCURRENCE_CREATED",
    subjectType: "ActivityOccurrence",
    subjectId: result.occurrence.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { activityId: params.id, startsAt: result.occurrence.startsAt, endsAt: result.occurrence.endsAt, capacity: result.occurrence.capacity },
  }).catch(() => undefined);

  return NextResponse.json({ occurrence: result.occurrence }, { status: 201 });
}
