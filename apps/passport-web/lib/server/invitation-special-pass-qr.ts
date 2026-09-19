import { getPrismaClient } from "@/lib/server/prisma";
import { createHash } from "node:crypto";
import { issueQrToken, getInvitationSpecialPassQrExpiry } from "@/lib/server/qr";
import { writeCoreAuditLog } from "@/lib/server/audit";
import type { UserRole } from "@prisma/client";

export type IssuerSubjectType = "invitation_request" | "special_pass";

export type InvitationSpecialPassQrIssueResult = {
  ok: true;
  token: string;
  tokenId: string;
  expiresAt: Date;
  revokedPreviousTokenIds: string[];
};

function auditReference(value: string | null | undefined): string | undefined {
  return value ? `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 16)}` : undefined;
}

async function canManageEventSubject(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  actor: { id: string; role: UserRole },
  eventId: string,
): Promise<boolean> {
  if (actor.role === "ADMIN") {
    return true;
  }

  if (actor.role === "EVENT_MANAGER") {
    const managed = await prisma.event.findFirst({
      where: { id: eventId, managerUserId: actor.id },
      select: { id: true },
    });
    return Boolean(managed);
  }

  return false;
}

async function loadSubject(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  subjectType: IssuerSubjectType,
  subjectId: string,
) {
  if (subjectType === "invitation_request") {
    return prisma.invitationRequest.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        userId: true,
        eventId: true,
        status: true,
        guestName: true,
      },
    });
  }

  return prisma.specialPass.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      userId: true,
      eventId: true,
      status: true,
      name: true,
    },
  });
}

function subjectTypeToDisplayKind(subjectType: IssuerSubjectType): string {
  return subjectType === "invitation_request" ? "invitation" : "special_pass";
}

export async function issueInvitationSpecialPassQr(input: {
  actor: { id: string; role: UserRole };
  subjectType: IssuerSubjectType;
  subjectId: string;
  auditContext?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}): Promise<InvitationSpecialPassQrIssueResult> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error("Database unavailable.");
  }

  const subject = await loadSubject(prisma, input.subjectType, input.subjectId);

  if (!subject) {
    throw new Error("Subject not found.");
  }

  if (!subject.eventId) {
    throw new Error("Subject is not bound to an event.");
  }

  if (subject.status !== "APPROVED") {
    throw new Error("Subject is not approved.");
  }

  if (!(await canManageEventSubject(prisma, input.actor, subject.eventId))) {
    throw new Error("Insufficient permissions to issue QR for this event.");
  }

  const event = await prisma.event.findUnique({
    where: { id: subject.eventId },
    select: { id: true, endDate: true },
  });

  if (!event) {
    throw new Error("Bound event not found.");
  }

  const expiresAt = getInvitationSpecialPassQrExpiry(event);
  if (expiresAt <= new Date()) {
    throw new Error("Cannot issue QR because the event has ended.");
  }

  // Revoke any prior ACTIVE INVITATION_SPECIAL_PASS QR tokens for this exact subject.
  const priorTokens = await prisma.qrToken.findMany({
    where: {
      type: "INVITATION_SPECIAL_PASS",
      status: "ACTIVE",
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
    select: { id: true },
  });

  const revokedPreviousTokenIds: string[] = [];

  if (priorTokens.length > 0) {
    const now = new Date();
    await prisma.qrToken.updateMany({
      where: {
        id: { in: priorTokens.map((token) => token.id) },
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
        updatedAt: now,
      },
    });
    revokedPreviousTokenIds.push(...priorTokens.map((token) => token.id));

    await writeCoreAuditLog({
      actorUserId: input.actor.id,
      action: "invitation_special_pass_qr.revoke_prior",
      subjectType: input.subjectType,
      subjectId: auditReference(input.subjectId),
      result: "revoked",
      ...input.auditContext,
      metadataJson: {
        revokedTokenRefs: revokedPreviousTokenIds.map(auditReference),
        eventRef: auditReference(subject.eventId),
      },
    }).catch(() => undefined);
  }

  const qr = await issueQrToken({
    type: "INVITATION_SPECIAL_PASS",
    userId: subject.userId,
    eventId: subject.eventId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    expiresAt,
    scopeJson: {
      actions: ["event_admission"],
    },
  });

  await writeCoreAuditLog({
    actorUserId: input.actor.id,
    action: "invitation_special_pass_qr.issue",
    subjectType: input.subjectType,
    subjectId: auditReference(input.subjectId),
    result: "issued",
    ...input.auditContext,
    metadataJson: {
      tokenRef: auditReference(qr.tokenId),
      eventRef: auditReference(subject.eventId),
      kind: subjectTypeToDisplayKind(input.subjectType),
      revokedTokenRefs: revokedPreviousTokenIds.map(auditReference),
    },
  }).catch(() => undefined);

  return {
    ok: true,
    token: qr.token,
    tokenId: qr.tokenId,
    expiresAt: qr.expiresAt ?? expiresAt,
    revokedPreviousTokenIds,
  };
}

export async function revokeInvitationSpecialPassQr(input: {
  actor: { id: string; role: UserRole };
  subjectType: IssuerSubjectType;
  subjectId: string;
  auditContext?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}): Promise<{ ok: true; revokedTokenIds: string[] }> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error("Database unavailable.");
  }

  const subject = await loadSubject(prisma, input.subjectType, input.subjectId);

  if (!subject) {
    throw new Error("Subject not found.");
  }

  if (!subject.eventId) {
    throw new Error("Subject is not bound to an event.");
  }

  if (!(await canManageEventSubject(prisma, input.actor, subject.eventId))) {
    throw new Error("Insufficient permissions to revoke QR for this event.");
  }

  const now = new Date();
  const update = await prisma.qrToken.updateMany({
    where: {
      type: "INVITATION_SPECIAL_PASS",
      status: "ACTIVE",
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
    data: {
      status: "REVOKED",
      revokedAt: now,
      updatedAt: now,
    },
  });

  const revokedTokenIds: string[] = [];
  if (update.count > 0) {
    const tokens = await prisma.qrToken.findMany({
      where: {
        type: "INVITATION_SPECIAL_PASS",
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        status: "REVOKED",
        revokedAt: { gte: now },
      },
      select: { id: true },
    });
    revokedTokenIds.push(...tokens.map((token) => token.id));
  }

  await writeCoreAuditLog({
    actorUserId: input.actor.id,
    action: "invitation_special_pass_qr.revoke",
    subjectType: input.subjectType,
    subjectId: auditReference(input.subjectId),
    result: "revoked",
    ...input.auditContext,
    metadataJson: {
      revokedTokenRefs: revokedTokenIds.map(auditReference),
      eventRef: auditReference(subject.eventId),
      kind: subjectTypeToDisplayKind(input.subjectType),
    },
  }).catch(() => undefined);

  return { ok: true, revokedTokenIds };
}
