import { BadgeVerificationGrade } from "@prisma/client";
import { NextResponse } from "next/server";
import { getBadgeVerificationPublicPayload } from "@/lib/server/achievement-badge";
import { getPrismaClient } from "@/lib/server/prisma";
import { checkRateLimitAsync, getRateLimitHeaders, getRequestRateLimitKey } from "@/lib/server/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  const rateLimit = await checkRateLimitAsync(getRequestRateLimitKey(request, "verify-badge"), { limit: 60, windowMs: 60_000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ valid: false, error: "Database unavailable." }, { status: 503 });
  }

  const award = await prisma.badgeAward.findFirst({
    where: { verificationToken: params.token },
    include: {
      user: { select: { name: true } },
      badgeDefinition: {
        select: {
          name: true,
          issuerName: true,
          verificationGrade: true,
          isPublic: true,
        },
      },
    },
  });

  if (!award || !award.badgeDefinition.isPublic) {
    return NextResponse.json({ valid: false, error: "Badge verification record not found." }, { status: 404 });
  }

  const grant = await prisma.governanceRewardGrant.findUnique({ where: { badgeAwardId: award.id }, select: { publicVisible: true, state: true } });
  if (grant && (!grant.publicVisible || grant.state !== "ACTIVE")) return NextResponse.json({ valid: false, error: "Badge verification record not found." }, { status: 404 });
  const snapshot = award.evidenceSnapshotJson as Record<string, unknown> | null;
  const governance = grant ? snapshot : null;
  const grade = governance?.verificationGrade;
  const frozenGrade = Object.values(BadgeVerificationGrade).find(value => value === grade);
  if (grant && (!governance || !frozenGrade)) return NextResponse.json({ valid: false, error: "Badge verification record unavailable." }, { status: 404 });
  return NextResponse.json({
    ...getBadgeVerificationPublicPayload({
      badgeName: governance ? String(governance.badgeName) : award.badgeDefinition.name,
      userDisplayName: award.user.name,
      issuerName: governance ? award.awardedByOrgName ?? String(governance.issuerName) : award.badgeDefinition.issuerName,
      awardedAt: award.awardedAt,
      verificationGrade: frozenGrade ?? award.badgeDefinition.verificationGrade,
      status: award.status,
    }),
    ...(governance ? { credentialClass: governance.credentialClass, assurance: governance.assurance } : {}),
  });
}
