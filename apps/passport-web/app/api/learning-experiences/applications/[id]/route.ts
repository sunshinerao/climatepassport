import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const updateApplicationSchema = z.object({
  answersJson: z.unknown(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/learning-experiences");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const application = await prisma.learningExperienceApplication.findUnique({
    where: { id: params.id },
    include: {
      program: {
        select: {
          id: true,
          slug: true,
          title: true,
          titleEn: true,
          applicationOpenAt: true,
          applicationCloseAt: true,
          status: true,
        },
      },
      currentStage: {
        select: {
          key: true,
          name: true,
          nameEn: true,
          order: true,
        },
      },
    },
  });

  if (!application || application.userId !== user.id) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  return NextResponse.json({ application });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/learning-experiences");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = updateApplicationSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const current = await prisma.learningExperienceApplication.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      status: true,
      program: {
        select: {
          applicationOpenAt: true,
          applicationCloseAt: true,
        },
      },
    },
  });

  if (!current || current.userId !== user.id) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  if (current.status !== "DRAFT") {
    return NextResponse.json({ error: "Only draft applications can be edited." }, { status: 409 });
  }

  const now = new Date();

  if (current.program.applicationOpenAt && current.program.applicationOpenAt > now) {
    return NextResponse.json({ error: "Application has not opened yet." }, { status: 400 });
  }

  if (current.program.applicationCloseAt && current.program.applicationCloseAt < now) {
    return NextResponse.json({ error: "Application is closed." }, { status: 400 });
  }

  const updated = await prisma.learningExperienceApplication.update({
    where: { id: current.id },
    data: {
      answersJson: payload.data.answersJson as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, application: updated });
}
