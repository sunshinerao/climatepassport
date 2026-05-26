import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { createAchievementRecord } from "@/lib/server/achievement-badge";
import { getPrismaClient } from "@/lib/server/prisma";

const querySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  verificationLevel: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(["LEARNING", "EVENT", "PROJECT", "CONTRIBUTION", "COMMUNICATION", "VERIFIED"]),
  points: z.number().int().min(0).max(10000).optional(),
  skillTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  topicTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  sdgTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  evidenceUrl: z.string().trim().url().max(500).optional(),
  evidenceText: z.string().trim().max(2000).optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/achievements");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query." }, { status: 400 });
  }

  const where = {
    userId: user.id,
    ...(parsed.data.type ? { type: parsed.data.type as never } : {}),
    ...(parsed.data.status ? { status: parsed.data.status as never } : {}),
    ...(parsed.data.verificationLevel ? { verificationLevel: parsed.data.verificationLevel as never } : {}),
  };

  const [total, achievements] = await Promise.all([
    prisma.achievement.count({ where }),
    prisma.achievement.findMany({
      where,
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      skip: (parsed.data.page - 1) * parsed.data.pageSize,
      take: parsed.data.pageSize,
    }),
  ]);

  return NextResponse.json({
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
    achievements,
  });
}

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/achievements");

  const payload = createSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const achievement = await createAchievementRecord({
    userId: user.id,
    name: payload.data.name,
    description: payload.data.description,
    type: payload.data.type,
    points: payload.data.points ?? 0,
    skillTags: payload.data.skillTags ?? [],
    topicTags: payload.data.topicTags ?? [],
    sdgTags: payload.data.sdgTags ?? [],
    evidenceUrl: payload.data.evidenceUrl,
    evidenceText: payload.data.evidenceText,
    isPublic: payload.data.isPublic ?? true,
    sourceType: "USER_SUBMISSION",
    status: "PENDING_REVIEW",
    verificationLevel: "SELF_RECORDED",
  });

  return NextResponse.json({ ok: true, achievement });
}
