import { NextRequest, NextResponse } from "next/server";
import { ActivityOccurrenceUpdateSchema } from "@climate-passport/passport-contracts";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { cancelOccurrence, updateOccurrence } from "@/lib/server/activity-occurrences";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-246：期次更新/取消（活动管理者；取消仅允许无已确认名额的 SCHEDULED 期次）。 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; occurrenceId: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (!(await canManageActivity(prisma, auth, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = ActivityOccurrenceUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result =
    parsed.data.status === "CANCELLED" && parsed.data.startsAt === undefined && parsed.data.endsAt === undefined && parsed.data.capacity === undefined && parsed.data.locationJson === undefined
      ? await cancelOccurrence(prisma, params.occurrenceId, params.id)
      : await updateOccurrence(prisma, {
          occurrenceId: params.occurrenceId,
          activityId: params.id,
          ...(parsed.data.startsAt !== undefined ? { startsAt: new Date(parsed.data.startsAt) } : {}),
          ...(parsed.data.endsAt !== undefined ? { endsAt: new Date(parsed.data.endsAt) } : {}),
          ...(parsed.data.capacity !== undefined ? { capacity: parsed.data.capacity } : {}),
          ...(parsed.data.locationJson !== undefined ? { locationJson: parsed.data.locationJson } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  await writeCoreAuditLog({
    actorUserId: auth.id,
    action: result.occurrence.status === "CANCELLED" ? "ACTIVITY_OCCURRENCE_CANCELLED" : "ACTIVITY_OCCURRENCE_UPDATED",
    subjectType: "ActivityOccurrence",
    subjectId: result.occurrence.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { activityId: params.id, status: result.occurrence.status, capacity: result.occurrence.capacity, admittedCount: result.occurrence.admittedCount },
  }).catch(() => undefined);

  return NextResponse.json({ occurrence: result.occurrence });
}
