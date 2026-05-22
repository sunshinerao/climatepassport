import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET() {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const programs = await prisma.learningExperienceProgram.findMany({
    where: {
      isPublished: true,
      status: { in: ["PUBLISHED", "CLOSED"] },
    },
    orderBy: [{ applicationOpenAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      titleEn: true,
      summary: true,
      summaryEn: true,
      location: true,
      locationEn: true,
      applicationOpenAt: true,
      applicationCloseAt: true,
      cohortStartAt: true,
      cohortEndAt: true,
      capacity: true,
      pointReward: true,
      status: true,
      category: {
        select: {
          name: true,
          nameEn: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
  });

  return NextResponse.json({ programs });
}
