import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const activity = await prisma.activity.findUnique({ where: { id: params.id } });
  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const [totalApplications, approvedApplications, totalParticipations, completedParticipations, totalCheckins, validCheckins, totalSubmissions, approvedSubmissions] =
    await Promise.all([
      prisma.activityApplication.count({ where: { activityId: params.id } }),
      prisma.activityApplication.count({ where: { activityId: params.id, status: "APPROVED" } }),
      prisma.activityParticipation.count({ where: { activityId: params.id } }),
      prisma.activityParticipation.count({ where: { activityId: params.id, status: "COMPLETED" } }),
      prisma.activityCheckinRecord.count({ where: { activityId: params.id } }),
      prisma.activityCheckinRecord.count({ where: { activityId: params.id, status: "VALID" } }),
      prisma.activitySubmission.count({ where: { activityId: params.id } }),
      prisma.activitySubmission.count({ where: { activityId: params.id, status: "APPROVED" } }),
    ]);

  return NextResponse.json({
    activityId: params.id,
    applications: { total: totalApplications, approved: approvedApplications },
    participations: { total: totalParticipations, completed: completedParticipations },
    checkins: { total: totalCheckins, valid: validCheckins },
    submissions: { total: totalSubmissions, approved: approvedSubmissions },
  });
}
