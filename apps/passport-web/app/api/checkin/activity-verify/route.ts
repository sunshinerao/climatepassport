import { NextResponse, type NextRequest } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { hashOpaqueToken } from "@climate-passport/passport-core";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";

/**
 * POST /api/checkin/activity-verify
 * Verifier or admin scans a user's ACTIVITY_CHECKIN QR token.
 * Body: { token: string, verifiedByUserId?: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER", "VERIFIER"], "/en/admin");
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { token, verifiedByUserId } = body as { token?: string; verifiedByUserId?: string };

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const tokenHash = hashOpaqueToken(token);

  const qr = await prisma.qrToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, name: true, email: true, climatePassportId: true } },
      activity: { select: { id: true, title: true, type: true } },
    },
  });

  if (!qr) {
    return NextResponse.json({ ok: false, result: "INVALID", message: "QR token not found" }, { status: 400 });
  }

  if (qr.type !== "ACTIVITY_CHECKIN") {
    return NextResponse.json({ ok: false, result: "INVALID", message: "Not an activity checkin token" }, { status: 400 });
  }

  if (qr.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, result: "CONSUMED", message: "Token already used or revoked" });
  }

  if (qr.expiresAt && qr.expiresAt < new Date()) {
    await prisma.qrToken.update({ where: { id: qr.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ ok: false, result: "EXPIRED", message: "QR token has expired" });
  }

  if (!qr.userId || !qr.activityId) {
    return NextResponse.json({ ok: false, result: "INVALID", message: "Malformed token" }, { status: 400 });
  }

  const scope = qr.scopeJson as Record<string, unknown> | null;
  const taskId: string | null = (scope?.taskId as string) ?? null;

  // Check for recent duplicate checkin (5 min window)
  const recentDup = await prisma.activityCheckinRecord.findFirst({
    where: {
      activityId: qr.activityId,
      userId: qr.userId,
      ...(taskId ? { taskId } : {}),
      checkinAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      status: "VALID",
    },
  });

  const checkinStatus = recentDup ? "DUPLICATE" : "VALID";

  // Record the checkin
  const record = await prisma.activityCheckinRecord.create({
    data: {
      activityId: qr.activityId,
      userId: qr.userId,
      taskId,
      method: "QR_CODE",
      status: checkinStatus,
      verifiedByUserId: verifiedByUserId ?? auth.id,
      checkinAt: new Date(),
    },
  });

  // Mark QR token as consumed (single-use)
  await prisma.qrToken.update({
    where: { id: qr.id },
    data: { status: "CONSUMED", consumedAt: new Date() },
  });

  // Update participation status to CHECKED_IN
  if (checkinStatus === "VALID") {
    await prisma.activityParticipation.updateMany({
      where: { activityId: qr.activityId, userId: qr.userId, status: { in: ["REGISTERED", "ACCEPTED"] } },
      data: { status: "CHECKED_IN" },
    });
    void triggerActivityRewards({ activityId: qr.activityId, userId: qr.userId, trigger: "CHECKIN_COMPLETED" });
  }

  return NextResponse.json({
    ok: true,
    result: checkinStatus,
    record: { id: record.id, checkinAt: record.checkinAt },
    user: qr.user,
    activity: qr.activity,
    taskId,
  });
}
