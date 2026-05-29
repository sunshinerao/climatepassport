import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";

export async function PATCH(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const ids = body.ids as string[] | undefined;
  const rawStatus = body.status as string | undefined;
  const reviewComment = body.reviewComment as string | undefined;

  const validStatuses = ["APPROVED", "REJECTED", "WAITLISTED", "PENDING_REVIEW"] as const;
  type ValidStatus = (typeof validStatuses)[number];
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (!rawStatus || !validStatuses.includes(rawStatus as ValidStatus)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }
  const status = rawStatus as ValidStatus;

  const applications = await prisma.activityApplication.findMany({
    where: { id: { in: ids } },
  });

  if (applications.length === 0) {
    return NextResponse.json({ error: "No applications found" }, { status: 404 });
  }

  // Verify all applications belong to activities managed by this user (if not admin)
  if (auth.role !== "ADMIN") {
    const activityIds = [...new Set(applications.map((a) => a.activityId))];
    const managedActivities = await prisma.activity.findMany({
      where: { id: { in: activityIds }, organizerUserId: auth.id },
      select: { id: true },
    });
    const managedIds = new Set(managedActivities.map((a) => a.id));
    const unauthorized = applications.some((a) => !managedIds.has(a.activityId));
    if (unauthorized) {
      return NextResponse.json({ error: "Forbidden: not all activities are managed by you" }, { status: 403 });
    }
  }

  // Update all applications
  const updated = await prisma.activityApplication.updateMany({
    where: { id: { in: ids } },
    data: {
      status,
      reviewComment: reviewComment || null,
      reviewedByUserId: auth.id,
      reviewedAt: new Date(),
    },
  });

  // Auto-create participation records for APPROVED
  if (status === "APPROVED") {
    for (const app of applications) {
      const participationExists = await prisma.activityParticipation.findUnique({
        where: { activityId_userId: { activityId: app.activityId, userId: app.userId } },
      });
      if (!participationExists) {
        await prisma.activityParticipation.create({
          data: {
            activityId: app.activityId,
            userId: app.userId,
            roleType: app.roleType ?? undefined,
            status: "ACCEPTED",
          },
        });
      }
      void triggerActivityRewards({
        activityId: app.activityId,
        userId: app.userId,
        trigger: "REGISTRATION_APPROVED",
      });
    }
  }

  return NextResponse.json({ ok: true, count: updated.count });
}
