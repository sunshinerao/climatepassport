import { Prisma } from "@prisma/client";
import { createOpaqueToken, hashOpaqueToken } from "@climate-passport/passport-core";
import type { QrTokenType } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";

export async function issueQrToken(input: {
  type: QrTokenType;
  userId?: string | null;
  eventId?: string | null;
  activityId?: string | null;
  certificateIssueId?: string | null;
  subjectType: string;
  subjectId: string;
  expiresAt?: Date | null;
  scopeJson?: Record<string, unknown> | null;
  metadataJson?: Record<string, unknown> | null;
}) {
  const prisma = getPrismaClient();

  if (!prisma) {
    throw new Error("Prisma client is unavailable.");
  }

  const rawToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);

  const token = await prisma.qrToken.create({
    data: {
      tokenHash,
      type: input.type,
      userId: input.userId ?? null,
      eventId: input.eventId ?? null,
      activityId: input.activityId ?? null,
      certificateIssueId: input.certificateIssueId ?? null,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      expiresAt: input.expiresAt ?? null,
      scopeJson: input.scopeJson ? (input.scopeJson as Prisma.InputJsonValue) : undefined,
      metadataJson: input.metadataJson ? (input.metadataJson as Prisma.InputJsonValue) : undefined,
    },
  });

  return {
    token: rawToken,
    tokenId: token.id,
    type: token.type,
    expiresAt: token.expiresAt,
  };
}

export function getEventCheckinQrExpiry() {
  return new Date(Date.now() + 1000 * 60 * 10);
}

export function getIdentityQrExpiry() {
  return new Date(Date.now() + 1000 * 60 * 2);
}
