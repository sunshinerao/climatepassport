import { NextRequest, NextResponse } from "next/server";
import { ActivityPersonRoleAssignSchema } from "@climate-passport/passport-contracts";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { assignActivityPersonRole, listActivityPeople } from "@/lib/server/activity-person-roles";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-246：活动人员角色（公开读取；统计按人去重，一人多角色不双计）。 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const people = await listActivityPeople(prisma, params.id);
  return NextResponse.json(people);
}

/** CP-TODO-246：指派人员角色（活动管理者；幂等，同一人同一角色只存在一条）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (!(await canManageActivity(prisma, auth, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = ActivityPersonRoleAssignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await assignActivityPersonRole(prisma, {
    activityId: params.id,
    personId: parsed.data.personId,
    roleType: parsed.data.roleType,
    sourceType: parsed.data.sourceType ?? null,
    sourceId: parsed.data.sourceId ?? null,
    note: parsed.data.note ?? null,
    createdByUserId: auth.id,
  });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  if (result.created) {
    await writeCoreAuditLog({
      actorUserId: auth.id,
      action: "ACTIVITY_PERSON_ROLE_ASSIGNED",
      subjectType: "ActivityPersonRole",
      subjectId: result.assignment.id,
      result: "SUCCESS",
      ...getRequestAuditContext(req),
      metadataJson: { activityId: params.id, personId: result.assignment.personId, roleType: result.assignment.roleType },
    }).catch(() => undefined);
  }

  return NextResponse.json({ assignment: result.assignment, created: result.created }, { status: result.created ? 201 : 200 });
}
