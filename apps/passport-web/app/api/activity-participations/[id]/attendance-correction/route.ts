import { NextRequest, NextResponse } from "next/server";
import { AttendanceCorrectionSchema } from "@climate-passport/passport-contracts";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext } from "@/lib/server/audit";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { recordAttendanceCorrection } from "@/lib/server/activity-participation";
import { requireApiRole } from "@/lib/server/api-auth";

/**
 * CP-TODO-246：出席补录/更正（CP-FR-056）。
 * 必须附理由与证据引用；已出席一律 409；不触发任何奖励（只成功核验生成奖励）。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const participation = await prisma.activityParticipation.findUnique({ where: { id: params.id } });
  if (!participation) return NextResponse.json({ error: "Participation not found", code: "PARTICIPATION_NOT_FOUND" }, { status: 404 });
  if (!(await canManageActivity(prisma, auth, participation.activityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = AttendanceCorrectionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const auditContext = getRequestAuditContext(req);
  const result = await prisma.$transaction(async (tx) => {
    const corrected = await recordAttendanceCorrection(tx, {
      participationId: participation.id,
      reason: parsed.data.reason,
      evidenceAssetIds: parsed.data.evidenceAssetIds,
      checkinAt: parsed.data.checkinAt ? new Date(parsed.data.checkinAt) : undefined,
      actorUserId: auth.id,
    });
    if ("error" in corrected) return corrected;

    await tx.coreAuditLog.create({
      data: {
        actorUserId: auth.id,
        action: "ACTIVITY_ATTENDANCE_CORRECTED",
        subjectType: "ActivityParticipation",
        subjectId: participation.id,
        result: "SUCCESS",
        ...auditContext,
        metadataJson: {
          activityId: participation.activityId,
          userId: participation.userId,
          fromStatus: participation.status,
          reason: parsed.data.reason,
          evidenceAssetIds: parsed.data.evidenceAssetIds ?? [],
          checkinRecordId: corrected.checkinRecordId,
        },
      },
    });
    return corrected;
  });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ ok: true, participationId: result.participationId, checkinRecordId: result.checkinRecordId, rewardsTriggered: result.rewardsTriggered });
}
