import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/learning-experiences");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const current = await prisma.learningExperienceApplication.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      status: true,
      answersJson: true,
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
    return NextResponse.json({ error: "Application already submitted." }, { status: 409 });
  }

  const now = new Date();

  if (current.program.applicationOpenAt && current.program.applicationOpenAt > now) {
    return NextResponse.json({ error: "Application has not opened yet." }, { status: 400 });
  }

  if (current.program.applicationCloseAt && current.program.applicationCloseAt < now) {
    return NextResponse.json({ error: "Application is closed." }, { status: 400 });
  }

  if (current.answersJson == null) {
    return NextResponse.json(
      { error: "Please save your application answers before submitting." },
      { status: 400 },
    );
  }

  const updated = await prisma.learningExperienceApplication.update({
    where: { id: current.id },
    data: {
      status: "SUBMITTED",
      submittedAt: now,
    },
  });

  return NextResponse.json({ ok: true, application: updated });
}
