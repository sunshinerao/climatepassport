import { NextResponse } from "next/server";
import { z } from "zod";
import { issueManualBadgeAward } from "@/lib/server/achievement-badge";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const createSchema = z.object({
  userId: z.string().uuid(),
  badgeDefinitionId: z.string().uuid(),
  awardedByOrgName: z.string().trim().max(120).optional(),
  relatedAchievementIds: z.array(z.string().uuid()).max(50).optional(),
});

export async function GET() {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/badges/awards");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const awards = await prisma.badgeAward.findMany({
    orderBy: [{ awardedAt: "desc" }],
    take: 300,
    include: {
      user: { select: { name: true, email: true } },
      badgeDefinition: { select: { name: true, code: true, category: true, level: true } },
    },
  });

  return NextResponse.json({ awards });
}

export async function POST(request: Request) {
  const admin = await requireRoleAccess("en", ["ADMIN"], "/en/admin/badges/awards");

  const payload = createSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const award = await issueManualBadgeAward({
    userId: payload.data.userId,
    badgeDefinitionId: payload.data.badgeDefinitionId,
    awardedByUserId: admin.id,
    awardedByOrgName: payload.data.awardedByOrgName,
    relatedAchievementIds: payload.data.relatedAchievementIds,
  });

  return NextResponse.json({ ok: true, award });
}
