import { GovernanceConditionSchema } from "@climate-passport/passport-contracts";
import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { requireApiRole } from "@/lib/server/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get("activityId") ?? undefined;

  if (!activityId) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (!(await canManageActivity(prisma, auth, activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rules = await prisma.activityRewardRule.findMany({
    where: { activityId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole(["ADMIN"], req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { activityId, trigger, rewardType, rewardValueJson, conditionJson } = body;

  if (!activityId || !trigger || !rewardType || rewardValueJson === undefined) {
    return NextResponse.json({ error: "Missing required fields: activityId, trigger, rewardType, rewardValueJson" }, { status: 400 });
  }

  if (!["REGISTRATION_APPROVED","CHECKIN_COMPLETED","TASK_COMPLETED","SUBMISSION_APPROVED","PARTICIPATION_COMPLETED"].includes(trigger)) return NextResponse.json({error:"Unsupported trigger"},{status:400});
  if (conditionJson != null && !GovernanceConditionSchema.safeParse(conditionJson).success) return NextResponse.json({error:"Unsupported condition",code:"GOV_UNSUPPORTED_CONDITION"},{status:400});
  const value=rewardValueJson;
  if (!value || typeof value!=="object" || Array.isArray(value)) return NextResponse.json({error:"Invalid reward"},{status:400});
  const valid=rewardType==="POINTS" ? Number.isSafeInteger(value.points)&&value.points>0&&value.points<=1000000&&Object.keys(value).every(k=>k==="points")
    : rewardType==="BADGE" ? typeof value.badgeDefinitionId==="string"&&Object.keys(value).every(k=>k==="badgeDefinitionId")
    : rewardType==="PASSPORT_ENTRY" ? Object.keys(value).length===0 : false;
  if(!valid) return NextResponse.json({error:"Unsupported or invalid reward",code:"GOV_UNSUPPORTED_REWARD"},{status:400});
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const rule = await prisma.activityRewardRule.create({
    data: { activityId, trigger, rewardType, rewardValueJson, conditionJson },
  });

  return NextResponse.json({ rule }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireApiRole(["ADMIN"], req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  await prisma.activityRewardRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
