import { hashOpaqueToken } from "@climate-passport/passport-core";
import { getPrismaClient } from "@/lib/server/prisma";

export type ResolveIdentityQrVerificationResult = {
  ok: boolean;
  status: "VALID" | "INVALID" | "MISSING_TOKEN" | "UNAVAILABLE";
  httpStatus: number;
  error?: string;
  verification?: {
    type: "IDENTITY";
    expiresAt: string | null;
    issuedAt: string;
    user: {
      id: string;
      name: string;
      role: string | null;
      climatePassportId: string | null;
      status: string;
    };
    metadata: Record<string, unknown> | null;
  };
};

export async function resolveIdentityQrVerification(token: string | null | undefined): Promise<ResolveIdentityQrVerificationResult> {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return {
      ok: false,
      status: "MISSING_TOKEN",
      error: "Missing token.",
      httpStatus: 400,
    };
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return {
      ok: false,
      status: "UNAVAILABLE",
      error: "Database unavailable.",
      httpStatus: 503,
    };
  }

  const qrToken = await prisma.qrToken.findFirst({
    where: {
      tokenHash: hashOpaqueToken(normalizedToken),
      type: "IDENTITY",
      status: "ACTIVE",
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          title: true,
          climatePassportId: true,
          status: true,
        },
      },
    },
  });

  if (!qrToken || !qrToken.user) {
    return {
      ok: false,
      status: "INVALID",
      error: "QR token is invalid or expired.",
      httpStatus: 404,
    };
  }

  return {
    ok: true,
    status: "VALID",
    httpStatus: 200,
    verification: {
      type: "IDENTITY",
      expiresAt: qrToken.expiresAt?.toISOString() ?? null,
      issuedAt: qrToken.createdAt.toISOString(),
      user: {
        id: qrToken.user.id,
        name: qrToken.user.name,
        role: qrToken.user.title,
        climatePassportId: qrToken.user.climatePassportId,
        status: qrToken.user.status,
      },
      metadata: (qrToken.metadataJson as Record<string, unknown> | null) ?? null,
    },
  };
}
