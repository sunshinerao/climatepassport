import { NextResponse } from "next/server";
import type { LearningExperienceApplicationStatus } from "@prisma/client";
import { learningApplicationStatusOptions } from "@/lib/learning-experiences";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiRole } from "@/lib/server/api-auth";

export async function GET(request: Request) {
  const user = await requireApiRole(["ADMIN", "EVENT_MANAGER"], request);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");

  const status = learningApplicationStatusOptions.includes(statusParam as (typeof learningApplicationStatusOptions)[number])
    ? (statusParam as LearningExperienceApplicationStatus)
    : null;

  const applications = await prisma.learningExperienceApplication.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(user.role === "EVENT_MANAGER"
        ? {
            program: {
              managerUserId: user.id,
            },
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      program: {
        select: {
          id: true,
          slug: true,
          title: true,
          titleEn: true,
          managerUserId: true,
          stages: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              key: true,
              name: true,
              nameEn: true,
              order: true,
            },
          },
        },
      },
      currentStage: {
        select: {
          id: true,
          key: true,
          name: true,
          nameEn: true,
          order: true,
        },
      },
      participation: {
        select: {
          id: true,
          status: true,
          completionPercent: true,
          pointsAwarded: true,
        },
      },
    },
    take: 200,
  });

  return NextResponse.json({ applications });
}
