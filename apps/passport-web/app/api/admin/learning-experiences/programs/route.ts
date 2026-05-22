import { NextResponse } from "next/server";
import {
  buildLearningProgramWriteData,
  learningProgramSchema,
  serializeLearningProgram,
} from "@/lib/server/admin-learning-experiences";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET() {
  const user = await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/learning-experiences");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const programs = await prisma.learningExperienceProgram.findMany({
    where: user.role === "ADMIN" ? undefined : { managerUserId: user.id },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      category: {
        select: {
          name: true,
          nameEn: true,
        },
      },
      manager: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          applications: true,
          participations: true,
        },
      },
    },
  });

  return NextResponse.json({ programs: programs.map(serializeLearningProgram) });
}

export async function POST(request: Request) {
  const user = await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/learning-experiences");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = learningProgramSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const managerUserId = user.role === "EVENT_MANAGER" ? user.id : payload.data.managerUserId || user.id;

  const program = await prisma.learningExperienceProgram.create({
    data: buildLearningProgramWriteData(payload.data, managerUserId),
    include: {
      category: {
        select: {
          name: true,
          nameEn: true,
        },
      },
      manager: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          applications: true,
          participations: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, program: serializeLearningProgram(program) });
}
