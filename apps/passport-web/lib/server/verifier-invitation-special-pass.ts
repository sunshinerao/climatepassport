import { hashOpaqueToken } from "@climate-passport/passport-core";
import { createHash } from "node:crypto";
import { getPrismaClient } from "@/lib/server/prisma";
import { writeCoreAuditLog } from "@/lib/server/audit";

export type InvitationSpecialPassScanResult =
  | { result: "invalid" }
  | { result: "expired" }
  | { result: "revoked" }
  | { result: "wrong_event" }
  | { result: "permission_denied" }
  | { result: "not_approved" }
  | { result: "already_used" }
  | { result: "unsupported_context" }
  | {
      result: "admitted";
      credentialKind: "invitation" | "special_pass";
      event: { title: string; titleEn: string | null };
      holderName: string | null;
    };

function auditReference(value: string | null | undefined): string | undefined {
  return value ? `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 16)}` : undefined;
}

function auditMetadata(input: {
  tokenId?: string | null;
  eventId?: string | null;
  subjectId?: string | null;
  [key: string]: unknown;
}) {
  const { tokenId, eventId, subjectId, ...context } = input;
  return {
    ...context,
    ...(auditReference(tokenId) ? { tokenRef: auditReference(tokenId) } : {}),
    ...(auditReference(eventId) ? { eventRef: auditReference(eventId) } : {}),
    ...(auditReference(subjectId) ? { subjectRef: auditReference(subjectId) } : {}),
  };
}

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

export async function scanInvitationSpecialPassQr(input: {
  token: string;
  eventId?: string | null;
  verifier: { id: string; role: string };
  auditContext?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}): Promise<InvitationSpecialPassScanResult> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return { result: "invalid" };
  }

  const tokenHash = hashOpaqueToken(input.token);
  const qr = await prisma.qrToken.findUnique({
    where: { tokenHash },
    include: {
      event: { select: { id: true, title: true, titleEn: true } },
    },
  });

  if (!qr || qr.type !== "INVITATION_SPECIAL_PASS") {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: "qr_token",
      result: "invalid",
      ...input.auditContext,
    }).catch(() => undefined);
    return { result: "invalid" };
  }

  const now = new Date();

  if (qr.status === "CONSUMED") {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "already_used",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId }),
    }).catch(() => undefined);
    return { result: "already_used" };
  }

  if (qr.status === "REVOKED") {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "revoked",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId }),
    }).catch(() => undefined);
    return { result: "revoked" };
  }

  if (qr.status === "EXPIRED") {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "expired",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId }),
    }).catch(() => undefined);
    return { result: "expired" };
  }

  if (qr.status !== "ACTIVE") {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "invalid",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId, status: qr.status }),
    }).catch(() => undefined);
    return { result: "invalid" };
  }

  if (qr.expiresAt && qr.expiresAt <= now) {
    await prisma.qrToken.update({
      where: { id: qr.id },
      data: { status: "EXPIRED", updatedAt: now },
    });
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "expired",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId }),
    }).catch(() => undefined);
    return { result: "expired" };
  }

  if (!qr.eventId) {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "invalid",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, subjectId: qr.subjectId, reason: "missing_event_binding" }),
    }).catch(() => undefined);
    return { result: "invalid" };
  }

  if (!qr.event) {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "invalid",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId, reason: "event_relation_missing" }),
    }).catch(() => undefined);
    return { result: "invalid" };
  }

  if (!input.eventId) {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "unsupported_context",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId, reason: "event_id_required" }),
    }).catch(() => undefined);
    return { result: "unsupported_context" };
  }

  if (input.eventId !== qr.eventId) {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "wrong_event",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId, scannedEventId: auditReference(input.eventId) }),
    }).catch(() => undefined);
    return { result: "wrong_event" };
  }

  if (!(await canVerifyEvent(prisma, input.verifier, qr.eventId))) {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: "event",
      subjectId: auditReference(qr.eventId),
      result: "permission_denied",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId }),
    }).catch(() => undefined);
    return { result: "permission_denied" };
  }

  let subject: { status: string; eventId: string | null; displayName: string | null } | null = null;

  if (qr.subjectType === "invitation_request") {
    const invitation = await prisma.invitationRequest.findUnique({
      where: { id: qr.subjectId },
      select: { status: true, eventId: true, guestName: true },
    });
    if (invitation) {
      subject = {
        status: invitation.status,
        eventId: invitation.eventId,
        displayName: invitation.guestName,
      };
    }
  } else if (qr.subjectType === "special_pass") {
    const specialPass = await prisma.specialPass.findUnique({
      where: { id: qr.subjectId },
      select: { status: true, eventId: true, name: true },
    });
    if (specialPass) {
      subject = {
        status: specialPass.status,
        eventId: specialPass.eventId,
        displayName: specialPass.name,
      };
    }
  }

  if (!subject || subject.eventId !== qr.eventId) {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "invalid",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId, reason: "subject_missing_or_unbound" }),
    }).catch(() => undefined);
    return { result: "invalid" };
  }

  if (subject.status !== "APPROVED") {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "not_approved",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId, subjectStatus: subject.status }),
    }).catch(() => undefined);
    return { result: "not_approved" };
  }

  // Atomic single-use consumption: conditional update on ACTIVE + unconsumed + not expired.
  const consumed = await prisma.qrToken.updateMany({
    where: {
      id: qr.id,
      status: "ACTIVE",
      consumedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    data: {
      status: "CONSUMED",
      consumedAt: now,
      updatedAt: now,
    },
  });

  if (consumed.count !== 1) {
    await writeCoreAuditLog({
      actorUserId: input.verifier.id,
      action: "verifier.invitation_special_pass_scan",
      subjectType: qr.subjectType,
      subjectId: auditReference(qr.subjectId),
      result: "already_used",
      ...input.auditContext,
      metadataJson: auditMetadata({ tokenId: qr.id, eventId: qr.eventId, subjectId: qr.subjectId, reason: "concurrent_consumption_race" }),
    }).catch(() => undefined);
    return { result: "already_used" };
  }

  await writeCoreAuditLog({
    actorUserId: input.verifier.id,
    action: "verifier.invitation_special_pass_scan",
    subjectType: qr.subjectType,
    subjectId: auditReference(qr.subjectId),
    result: "admitted",
    ...input.auditContext,
    metadataJson: auditMetadata({
      tokenId: qr.id,
      eventId: qr.eventId,
      subjectId: qr.subjectId,
      kind: qr.subjectType === "invitation_request" ? "invitation" : "special_pass",
    }),
  }).catch(() => undefined);

  return {
    result: "admitted",
    credentialKind: qr.subjectType === "invitation_request" ? "invitation" : "special_pass",
    event: {
      title: qr.event.title,
      titleEn: qr.event.titleEn,
    },
    holderName: subject.displayName,
  };
}
