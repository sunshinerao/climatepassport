import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ensureMvpBadgeDefinitions } from "@/lib/server/achievement-badge";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const createSchema = z.object({
  code: z.string().trim().min(3).max(64),
  name: z.string().trim().min(2).max(120),
  nameZh: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  descriptionZh: z.string().trim().max(2000).optional(),
  category: z.enum(["PARTICIPATION", "LEARNING", "CAPABILITY", "ROLE", "CONTRIBUTION", "IMPACT"]),
  level: z.enum(["EXPLORER", "LEARNER", "PRACTITIONER", "LEADER", "AMBASSADOR"]).optional(),
  verificationGrade: z.enum(["BASIC", "VERIFIED", "INSTITUTIONAL", "EXPERT_REVIEWED", "CREDENTIAL_GRADE"]).optional(),
  requiredPoints: z.number().int().min(0).max(20000).optional(),
  requiredAchievementTypes: z.array(z.enum(["LEARNING", "EVENT", "PROJECT", "CONTRIBUTION", "COMMUNICATION", "VERIFIED"]))
    .max(20)
    .optional(),
  minVerificationLevel: z.enum([
    "SELF_RECORDED",
    "SYSTEM_RECORDED",
    "PLATFORM_VERIFIED",
    "INSTITUTION_VERIFIED",
    "EXPERT_REVIEWED",
  ]).optional(),
  criteriaText: z.string().trim().max(2000).optional(),
  criteriaJson: z.record(z.string(), z.unknown()).optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() });

export async function GET() {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/badges/definitions");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  await ensureMvpBadgeDefinitions();

  const definitions = await prisma.badgeDefinition.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ definitions });
}

export async function POST(request: Request) {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/badges/definitions");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = createSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const definition = await prisma.badgeDefinition.create({
    data: {
      code: payload.data.code,
      name: payload.data.name,
      nameZh: payload.data.nameZh,
      description: payload.data.description,
      descriptionZh: payload.data.descriptionZh,
      category: payload.data.category,
      level: payload.data.level,
      verificationGrade: payload.data.verificationGrade ?? "BASIC",
      requiredPoints: payload.data.requiredPoints,
      requiredAchievementTypes: payload.data.requiredAchievementTypes ?? [],
      requiredAchievementIds: [],
      requiredSkillTags: [],
      requiredTopicTags: [],
      minVerificationLevel: payload.data.minVerificationLevel,
      criteriaText: payload.data.criteriaText,
      criteriaJson: payload.data.criteriaJson as Prisma.InputJsonValue | undefined,
      displayOrder: payload.data.displayOrder ?? 0,
      isPublic: payload.data.isPublic ?? true,
      isActive: payload.data.isActive ?? true,
    },
  });

  return NextResponse.json({ ok: true, definition });
}

export async function PATCH(request: Request) {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/badges/definitions");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = updateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const definition = await prisma.badgeDefinition.update({
    where: { id: payload.data.id },
    data: {
      ...(payload.data.code ? { code: payload.data.code } : {}),
      ...(payload.data.name ? { name: payload.data.name } : {}),
      ...(payload.data.nameZh !== undefined ? { nameZh: payload.data.nameZh } : {}),
      ...(payload.data.description !== undefined ? { description: payload.data.description } : {}),
      ...(payload.data.descriptionZh !== undefined ? { descriptionZh: payload.data.descriptionZh } : {}),
      ...(payload.data.category ? { category: payload.data.category } : {}),
      ...(payload.data.level !== undefined ? { level: payload.data.level } : {}),
      ...(payload.data.verificationGrade ? { verificationGrade: payload.data.verificationGrade } : {}),
      ...(payload.data.requiredPoints !== undefined ? { requiredPoints: payload.data.requiredPoints } : {}),
      ...(payload.data.requiredAchievementTypes ? { requiredAchievementTypes: payload.data.requiredAchievementTypes } : {}),
      ...(payload.data.minVerificationLevel !== undefined ? { minVerificationLevel: payload.data.minVerificationLevel } : {}),
      ...(payload.data.criteriaText !== undefined ? { criteriaText: payload.data.criteriaText } : {}),
      ...(payload.data.criteriaJson !== undefined
        ? { criteriaJson: payload.data.criteriaJson as Prisma.InputJsonValue }
        : {}),
      ...(payload.data.displayOrder !== undefined ? { displayOrder: payload.data.displayOrder } : {}),
      ...(payload.data.isPublic !== undefined ? { isPublic: payload.data.isPublic } : {}),
      ...(payload.data.isActive !== undefined ? { isActive: payload.data.isActive } : {}),
    },
  });

  return NextResponse.json({ ok: true, definition });
}
