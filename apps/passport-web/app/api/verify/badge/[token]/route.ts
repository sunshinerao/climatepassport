import { NextResponse } from "next/server";
import { getBadgeVerificationPublicPayload } from "@/lib/server/achievement-badge";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
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

  return NextResponse.json(
    getBadgeVerificationPublicPayload({
      badgeName: award.badgeDefinition.name,
      userDisplayName: award.user.name,
      issuerName: award.badgeDefinition.issuerName,
      awardedAt: award.awardedAt,
      verificationGrade: award.badgeDefinition.verificationGrade,
      status: award.status,
    }),
  );
}
