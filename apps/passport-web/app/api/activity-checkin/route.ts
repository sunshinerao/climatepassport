import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get("activityId") ?? undefined;
  const taskId = searchParams.get("taskId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const where = {
    ...(activityId ? { activityId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(userId ? { userId } : {}),
    ...(status ? { status: status as any } : {}),
  };

  const [total, records] = await Promise.all([
    prisma.activityCheckinRecord.count({ where }),
    prisma.activityCheckinRecord.findMany({
      where,
      orderBy: { checkinAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ records, total, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER", "VERIFIER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { activityId, taskId, userId, method, locationLat, locationLng, locationJson, verifiedByUserId } = body;

  if (!activityId || !userId || !method) {
    return NextResponse.json({ error: "Missing required fields: activityId, userId, method" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  // Check for duplicate within 5 minutes for same task
  const recentDuplicate = await prisma.activityCheckinRecord.findFirst({
    where: {
      activityId,
      userId,
      ...(taskId ? { taskId } : {}),
      checkinAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      status: "VALID",
    },
  });

  const status = recentDuplicate ? "DUPLICATE" : "VALID";

  const record = await prisma.activityCheckinRecord.create({
    data: {
      activityId,
      taskId,
      userId,
      method,
      status,
      locationLat,
      locationLng,
      locationJson,
      verifiedByUserId,
      checkinAt: new Date(),
    },
  });

  // Update participation status to CHECKED_IN if valid
  if (status === "VALID") {
    await prisma.activityParticipation.updateMany({
      where: { activityId, userId, status: { in: ["REGISTERED", "ACCEPTED"] } },
      data: { status: "CHECKED_IN" },
    });
    void triggerActivityRewards({ activityId, userId, trigger: "CHECKIN_COMPLETED" });

    // Consecutive check-in streak reward
    void (async () => {
      try {
        // Fetch all valid checkin timestamps for this user+activity, sorted desc
        const allCheckins = await prisma.activityCheckinRecord.findMany({
          where: { activityId, userId, status: "VALID" },
          orderBy: { checkinAt: "desc" },
          select: { checkinAt: true },
        });

        // Compute streak: count consecutive distinct UTC days ending today
        const uniqueDays = Array.from(
          new Set(
            allCheckins.map((c) =>
              new Date(c.checkinAt).toISOString().slice(0, 10)
            )
          )
        ).sort().reverse(); // desc: most recent first

        let streak = 0;
        const today = new Date().toISOString().slice(0, 10);
        let expected = today;
        for (const day of uniqueDays) {
          if (day === expected) {
            streak++;
            // Compute the previous day
            const d = new Date(expected + "T00:00:00Z");
            d.setUTCDate(d.getUTCDate() - 1);
            expected = d.toISOString().slice(0, 10);
          } else {
            break;
          }
        }

        if (streak < 2) return; // No streak reward below 2-day streak

        // Check if any CONSECUTIVE_CHECKIN rules match this streak
        const streakRules = await prisma.activityRewardRule.findMany({
          where: { activityId, trigger: "CONSECUTIVE_CHECKIN" },
          select: { id: true, conditionJson: true },
        });

        for (const rule of streakRules) {
          const condition = (rule.conditionJson ?? {}) as Record<string, unknown>;
          const required = typeof condition.streakRequired === "number" ? condition.streakRequired : null;
          if (required === null || streak !== required) continue;

          // Fire the reward for exactly this streak day (idempotency via streak milestone)
          await triggerActivityRewards({ activityId, userId, trigger: "CONSECUTIVE_CHECKIN" });
          break; // avoid double-firing if multiple rules match same streak
        }
      } catch (err) {
        console.error("[activity-checkin] streak reward error", err);
      }
    })();
  }

  return NextResponse.json({ record, status }, { status: 201 });
}
