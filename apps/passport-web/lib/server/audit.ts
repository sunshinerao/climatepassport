import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";

export function getHeaderAuditContext(headers: Headers) {
  return {
    ipAddress: headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? null,
    userAgent: headers.get("user-agent")?.slice(0, 240) ?? null,
  };
}

export function getRequestAuditContext(request: Request) {
  return getHeaderAuditContext(request.headers);
}

export async function writeCoreAuditLog(input: {
  actorUserId?: string | null;
  action: string;
  subjectType: string;
  subjectId?: string | null;
  result: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadataJson?: Record<string, unknown> | null;
}) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return null;
  }

  return prisma.coreAuditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      result: input.result,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadataJson: input.metadataJson ? (input.metadataJson as Prisma.InputJsonValue) : undefined,
    },
  });
}
