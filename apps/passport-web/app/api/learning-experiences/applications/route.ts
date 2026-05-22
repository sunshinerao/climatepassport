import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const createApplicationSchema = z.object({
  programId: z.string().trim().min(1),
  answersJson: z.unknown().optional(),
});

export async function GET() {
  const user = await requireAuthenticatedUser("en", "/en/dashboard");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const applications = await prisma.learningExperienceApplication.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      program: {
        select: {
          id: true,
          slug: true,
          title: true,
          titleEn: true,
          status: true,
        },
      },
      currentStage: {
        select: {
          key: true,
          name: true,
          nameEn: true,
        },
      },
    },
  });

  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = createApplicationSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const program = await prisma.learningExperienceProgram.findUnique({
    where: { id: payload.data.programId },
    select: {
      id: true,
      status: true,
      applicationOpenAt: true,
      applicationCloseAt: true,
      stages: {
        orderBy: { order: "asc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!program || (program.status !== "PUBLISHED" && program.status !== "CLOSED")) {
    return NextResponse.json({ error: "Program unavailable." }, { status: 404 });
  }

  const now = new Date();
  if (program.applicationOpenAt && program.applicationOpenAt > now) {
    return NextResponse.json({ error: "Application has not opened yet." }, { status: 400 });
  }

  if (program.applicationCloseAt && program.applicationCloseAt < now) {
    return NextResponse.json({ error: "Application is closed." }, { status: 400 });
  }

  const existing = await prisma.learningExperienceApplication.findUnique({
    where: {
      programId_userId: {
        programId: program.id,
        userId: user.id,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Application already exists for this program." }, { status: 409 });
  }

  const created = await prisma.learningExperienceApplication.create({
    data: {
      programId: program.id,
      userId: user.id,
      currentStageId: program.stages[0]?.id ?? null,
      status: "DRAFT",
      answersJson: payload.data.answersJson == null ? undefined : payload.data.answersJson,
    },
    include: {
      program: {
        select: {
          title: true,
          titleEn: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, application: created });
}
