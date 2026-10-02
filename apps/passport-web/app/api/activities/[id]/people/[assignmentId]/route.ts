import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { revokeActivityPersonRole } from "@/lib/server/activity-person-roles";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-246：撤销人员角色指派（活动管理者）。 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string; assignmentId: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (!(await canManageActivity(prisma, auth, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await revokeActivityPersonRole(prisma, { assignmentId: params.assignmentId, activityId: params.id });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  await writeCoreAuditLog({
    actorUserId: auth.id,
    action: "ACTIVITY_PERSON_ROLE_REVOKED",
    subjectType: "ActivityPersonRole",
    subjectId: params.assignmentId,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { activityId: params.id },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
