import { hashOpaqueToken } from "@climate-passport/passport-core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { createAchievementRecord } from "@/lib/server/achievement-badge";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { canVerifyActivity } from "@/lib/server/verifier-activity";
import { triggerActivityRewards } from "@/lib/server/activity-rewards";

const scanSchema = z.object({
  token: z.string().trim().min(8),
  eventId: z.string().uuid().optional(),
});

async function canVerifyEvent(prisma: NonNullable<ReturnType<typeof getPrismaClient>>, verifier: { id: string; role: string }, eventId: string) {
  if (verifier.role === "ADMIN") {
    return true;
  }

  if (verifier.role === "EVENT_MANAGER") {
    const managed = await prisma.event.findFirst({
      where: { id: eventId, managerUserId: verifier.id },
      select: { id: true },
    });
    return Boolean(managed);
  }

  const assignment = await prisma.eventVerifier.findUnique({
    where: {
      userId_eventId: {
        userId: verifier.id,
        eventId,
      },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

export async function POST(request: Request) {
  const verifier = await getCurrentUser();
  if (!verifier) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!["ADMIN", "EVENT_MANAGER", "VERIFIER"].includes(verifier.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const prisma = getPrismaClient();
  const auditContext = getRequestAuditContext(request);

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = scanSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const tokenHash = hashOpaqueToken(payload.data.token);
  const qr = await prisma.qrToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, name: true, climatePassportId: true, status: true } },
      event: { select: { id: true, title: true, titleEn: true } },
    },
  });

  if (!qr || qr.status !== "ACTIVE") {
    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.scan", subjectType: "qr_token", result: "invalid", ...auditContext });
    return NextResponse.json({ result: "invalid" }, { status: 404 });
  }

  if (qr.expiresAt && qr.expiresAt <= new Date()) {
    await prisma.qrToken.update({ where: { id: qr.id }, data: { status: "EXPIRED" } });
    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.scan", subjectType: "qr_token", subjectId: qr.id, result: "expired", ...auditContext });
    return NextResponse.json({ result: "expired" }, { status: 410 });
  }

  if (qr.type === "IDENTITY") {
    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.identity", subjectType: "user", subjectId: qr.userId, result: "valid", ...auditContext });
    return NextResponse.json({
      result: "valid",
      type: "IDENTITY",
      identity: {
        name: qr.user?.name ?? null,
        climatePassportId: qr.user?.climatePassportId ?? null,
        status: qr.user?.status ?? null,
      },
    });
  }

  // Handle ACTIVITY_CHECKIN (unified Activity framework)
  if (qr.type === "ACTIVITY_CHECKIN" && qr.activityId && qr.userId) {
    if (payload.data.eventId && payload.data.eventId !== qr.activityId) {
      await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.activity_checkin", subjectType: "activity", subjectId: qr.activityId, result: "wrong_activity", ...auditContext });
      return NextResponse.json({ result: "wrong_event" }, { status: 409 });
    }

    if (!(await canVerifyActivity(prisma, verifier, qr.activityId))) {
      await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.activity_checkin", subjectType: "activity", subjectId: qr.activityId, result: "permission_denied", ...auditContext });
      return NextResponse.json({ result: "permission_denied" }, { status: 403 });
    }

    const participation = await prisma.activityParticipation.findUnique({
      where: {
        activityId_userId: {
          activityId: qr.activityId,
          userId: qr.userId,
        },
      },
      select: { id: true, status: true },
    });

    if (!participation) {
      await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.activity_checkin", subjectType: "activity", subjectId: qr.activityId, result: "not_registered", ...auditContext });
      return NextResponse.json({ result: "not_registered" }, { status: 404 });
    }

    if (!["REGISTERED", "ACCEPTED", "CHECKED_IN"].includes(participation.status)) {
      await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.activity_checkin", subjectType: "activity_participation", subjectId: participation.id, result: "not_approved", ...auditContext });
      return NextResponse.json({ result: "not_approved" }, { status: 409 });
    }

    if (participation.status === "CHECKED_IN") {
      await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.activity_checkin", subjectType: "activity_participation", subjectId: participation.id, result: "already_checked_in", ...auditContext });
      return NextResponse.json({ result: "already_checked_in" });
    }

    const activity = await prisma.activity.findUnique({
      where: { id: qr.activityId },
      select: { id: true, title: true, titleEn: true },
    });

    const now = new Date();
    await prisma.$transaction([
      prisma.activityParticipation.update({
        where: { id: participation.id },
        data: {
          status: "CHECKED_IN",
        },
      }),
      prisma.activityCheckinRecord.create({
        data: {
          activityId: qr.activityId,
          userId: qr.userId,
          method: "QR_CODE",
          status: "VALID",
          verifiedByUserId: verifier.id,
          checkinAt: now,
        },
      }),
      prisma.qrToken.update({
        where: { id: qr.id },
        data: {
          status: "CONSUMED",
          consumedAt: now,
        },
      }),
    ]);

    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.activity_checkin", subjectType: "activity_participation", subjectId: participation.id, result: "checked_in", ...auditContext });

    // Trigger rewards
    void triggerActivityRewards({
      activityId: qr.activityId,
      userId: qr.userId,
      trigger: "CHECKIN_COMPLETED",
    });

    await createAchievementRecord({
      userId: qr.userId,
      name: activity?.titleEn ?? activity?.title ?? "Activity check-in",
      description: "Activity attendance verified by QR check-in.",
      type: "EVENT",
      sourceType: "EVENT_CHECKIN",
      sourceId: `checkin:${participation.id}`,
      verificationLevel: "PLATFORM_VERIFIED",
      points: 30,
      relatedEventId: qr.activityId,
      completedAt: now,
      skillTags: ["participation"],
      topicTags: ["event"],
      sdgTags: ["SDG13"],
    });

    return NextResponse.json({
      result: "checked_in",
      user: {
        name: qr.user?.name ?? null,
        climatePassportId: qr.user?.climatePassportId ?? null,
      },
      event: activity,
    });
  }

  // Handle legacy EVENT_CHECKIN (Event model)
  if (qr.type !== "EVENT_CHECKIN" || !qr.eventId || !qr.userId) {
    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.scan", subjectType: "qr_token", subjectId: qr.id, result: "unsupported", ...auditContext });
    return NextResponse.json({ result: "unsupported" }, { status: 400 });
  }

  if (payload.data.eventId && payload.data.eventId !== qr.eventId) {
    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.event_checkin", subjectType: "event", subjectId: qr.eventId, result: "wrong_event", ...auditContext });
    return NextResponse.json({ result: "wrong_event" }, { status: 409 });
  }

  if (!(await canVerifyEvent(prisma, verifier, qr.eventId))) {
    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.event_checkin", subjectType: "event", subjectId: qr.eventId, result: "permission_denied", ...auditContext });
    return NextResponse.json({ result: "permission_denied" }, { status: 403 });
  }

  const registration = await prisma.registration.findUnique({
    where: {
      userId_eventId: {
        userId: qr.userId,
        eventId: qr.eventId,
      },
    },
    select: { id: true, status: true, checkedInAt: true },
  });

  if (!registration) {
    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.event_checkin", subjectType: "event", subjectId: qr.eventId, result: "not_registered", ...auditContext });
    return NextResponse.json({ result: "not_registered" }, { status: 404 });
  }

  if (registration.status !== "REGISTERED" && registration.status !== "ATTENDED") {
    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.event_checkin", subjectType: "registration", subjectId: registration.id, result: "not_approved", ...auditContext });
    return NextResponse.json({ result: "not_approved" }, { status: 409 });
  }

  if (registration.checkedInAt) {
    await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.event_checkin", subjectType: "registration", subjectId: registration.id, result: "already_checked_in", ...auditContext });
    return NextResponse.json({ result: "already_checked_in" });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.registration.update({
      where: { id: registration.id },
      data: {
        status: "ATTENDED",
        checkedInAt: now,
        checkedInBy: verifier.id,
        checkInMethod: "QR_SCAN",
      },
    }),
    prisma.checkIn.create({
      data: {
        userId: qr.userId,
        eventId: qr.eventId,
        scannedBy: verifier.id,
        scannedAt: now,
        method: "QR_SCAN",
      },
    }),
    prisma.qrToken.update({
      where: { id: qr.id },
      data: {
        status: "CONSUMED",
        consumedAt: now,
      },
    }),
  ]);

  await writeCoreAuditLog({ actorUserId: verifier.id, action: "verifier.event_checkin", subjectType: "registration", subjectId: registration.id, result: "checked_in", ...auditContext });

  await createAchievementRecord({
    userId: qr.userId,
    name: qr.event?.titleEn ?? qr.event?.title ?? "Event check-in",
    description: "Event attendance verified by QR check-in.",
    type: "EVENT",
    sourceType: "EVENT_CHECKIN",
    sourceId: `checkin:${registration.id}`,
    verificationLevel: "PLATFORM_VERIFIED",
    points: 30,
    relatedEventId: qr.eventId,
    completedAt: now,
    skillTags: ["participation"],
    topicTags: ["event"],
    sdgTags: ["SDG13"],
  });

  return NextResponse.json({
    result: "checked_in",
    user: {
      name: qr.user?.name ?? null,
      climatePassportId: qr.user?.climatePassportId ?? null,
    },
    event: qr.event,
  });
}
