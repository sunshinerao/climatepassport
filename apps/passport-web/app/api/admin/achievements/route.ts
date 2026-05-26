import { NextResponse } from "next/server";
import { z } from "zod";
import { createAchievementRecord } from "@/lib/server/achievement-badge";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const createSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(["LEARNING", "EVENT", "PROJECT", "CONTRIBUTION", "COMMUNICATION", "VERIFIED"]),
  points: z.number().int().min(0).max(20000).optional(),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "REVOKED"]).optional(),
  verificationLevel: z.enum([
    "SELF_RECORDED",
    "SYSTEM_RECORDED",
    "PLATFORM_VERIFIED",
    "INSTITUTION_VERIFIED",
    "EXPERT_REVIEWED",
  ]).optional(),
  sourceType: z.enum([
    "USER_SUBMISSION",
    "SYSTEM_EVENT",
    "COURSE_COMPLETION",
    "EVENT_REGISTRATION",
    "EVENT_CHECKIN",
    "PROJECT_SUBMISSION",
    "ADMIN_CREATED",
    "INSTITUTION_IMPORT",
    "CERTIFICATE_ISSUED",
  ]).optional(),
  sourceId: z.string().trim().max(120).optional(),
  relatedEventId: z.string().trim().max(120).optional(),
  relatedProjectId: z.string().trim().max(120).optional(),
  relatedCertificateId: z.string().trim().max(120).optional(),
  skillTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  topicTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  sdgTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  evidenceUrl: z.string().trim().url().max(500).optional(),
  evidenceText: z.string().trim().max(2000).optional(),
  isPublic: z.boolean().optional(),
  isBadgeEligible: z.boolean().optional(),
});

export async function GET() {
  await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/achievements");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const achievements = await prisma.achievement.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ achievements });
}

export async function POST(request: Request) {
  await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/achievements");

  const payload = createSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const achievement = await createAchievementRecord({
    userId: payload.data.userId,
    name: payload.data.name,
    description: payload.data.description,
    type: payload.data.type,
    points: payload.data.points,
    status: payload.data.status,
    verificationLevel: payload.data.verificationLevel,
    sourceType: payload.data.sourceType ?? "ADMIN_CREATED",
    sourceId: payload.data.sourceId,
    relatedEventId: payload.data.relatedEventId,
    relatedProjectId: payload.data.relatedProjectId,
    relatedCertificateId: payload.data.relatedCertificateId,
    skillTags: payload.data.skillTags,
    topicTags: payload.data.topicTags,
    sdgTags: payload.data.sdgTags,
    evidenceUrl: payload.data.evidenceUrl,
    evidenceText: payload.data.evidenceText,
    isPublic: payload.data.isPublic,
    isBadgeEligible: payload.data.isBadgeEligible,
  });

  return NextResponse.json({ ok: true, achievement });
}
