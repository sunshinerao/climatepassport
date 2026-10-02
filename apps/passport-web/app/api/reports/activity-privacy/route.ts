import { NextRequest, NextResponse } from "next/server";
import { ActivityPrivacyReportQuerySchema } from "@climate-passport/passport-contracts";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { activityPrivacyReport } from "@/lib/server/privacy-reports";

/** CP-TODO-257：活动维隐私安全聚合报告（小样本抑制；管理员/活动管理者）。 */
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const parsed = ActivityPrivacyReportQuerySchema.safeParse({ activityId: searchParams.get("activityId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "activityId (uuid) is required" }, { status: 400 });
  }
  if (!(await canManageActivity(prisma, currentUser, parsed.data.activityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const report = await activityPrivacyReport(prisma, { activityId: parsed.data.activityId });
  return NextResponse.json(report);
}
