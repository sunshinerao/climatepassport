import { NextResponse } from "next/server";
import { z } from "zod";
import type { LearningExperienceApplicationStatus } from "@prisma/client";
import { learningApplicationStatusOptions } from "@/lib/server/admin-learning-experiences";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const statusTransitionMap: Record<LearningExperienceApplicationStatus, LearningExperienceApplicationStatus[]> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["UNDER_REVIEW", "INTERVIEW", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: ["INTERVIEW", "OFFERED", "WAITLISTED", "REJECTED"],
  INTERVIEW: ["UNDER_REVIEW", "OFFERED", "WAITLISTED", "REJECTED"],
  OFFERED: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  WAITLISTED: ["OFFERED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: ["ENROLLED", "WITHDRAWN"],
  ENROLLED: ["COMPLETED", "WITHDRAWN"],
  COMPLETED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const updateStatusSchema = z.object({
  status: z.enum(learningApplicationStatusOptions),
  reviewNotes: z.string().trim().max(6000).optional(),
  stageKey: z.string().trim().min(1).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/learning-experiences");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = updateStatusSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const current = await prisma.learningExperienceApplication.findUnique({
    where: { id: params.id },
    include: {
      program: {
        select: {
          id: true,
          managerUserId: true,
          stages: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              key: true,
            },
          },
        },
      },
      participation: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  if (user.role === "EVENT_MANAGER" && current.program.managerUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = statusTransitionMap[current.status] || [];

  if (!allowed.includes(payload.data.status)) {
    return NextResponse.json(
      { error: `Status transition not allowed: ${current.status} -> ${payload.data.status}` },
      { status: 409 },
    );
  }

  const targetStage = payload.data.stageKey
    ? current.program.stages.find((item) => item.key === payload.data.stageKey)
    : null;

  const now = new Date();
  const nextStatus = payload.data.status;

  const updateData: {
    status: LearningExperienceApplicationStatus;
    reviewNotes?: string | null;
    currentStageId?: string | null;
    submittedAt?: Date;
    reviewedAt?: Date;
    decidedAt?: Date;
  } = {
    status: nextStatus,
  };

  if (payload.data.reviewNotes !== undefined) {
    updateData.reviewNotes = payload.data.reviewNotes || null;
  }

  if (targetStage) {
    updateData.currentStageId = targetStage.id;
  }

  if (nextStatus === "SUBMITTED" && !current.submittedAt) {
    updateData.submittedAt = now;
  }

  if (["UNDER_REVIEW", "INTERVIEW", "OFFERED", "WAITLISTED", "REJECTED", "ACCEPTED"].includes(nextStatus)) {
    updateData.reviewedAt = now;
  }

  if (["OFFERED", "WAITLISTED", "REJECTED", "ACCEPTED", "ENROLLED", "COMPLETED"].includes(nextStatus)) {
    updateData.decidedAt = now;
  }

  const application = await prisma.$transaction(async (tx) => {
    const updated = await tx.learningExperienceApplication.update({
      where: { id: current.id },
      data: updateData,
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
    });

    if (nextStatus === "ACCEPTED") {
      await tx.learningExperienceParticipation.upsert({
        where: {
          programId_userId: {
            programId: current.programId,
            userId: current.userId,
          },
        },
        create: {
          programId: current.programId,
          userId: current.userId,
          applicationId: current.id,
          status: "ADMITTED",
        },
        update: {
          applicationId: current.id,
          status: "ADMITTED",
        },
      });
    }

    if (nextStatus === "ENROLLED") {
      await tx.learningExperienceParticipation.upsert({
        where: {
          programId_userId: {
            programId: current.programId,
            userId: current.userId,
          },
        },
        create: {
          programId: current.programId,
          userId: current.userId,
          applicationId: current.id,
          status: "ACTIVE",
          startedAt: now,
        },
        update: {
          applicationId: current.id,
          status: "ACTIVE",
          startedAt: now,
        },
      });
    }

    if (nextStatus === "COMPLETED") {
      await tx.learningExperienceParticipation.upsert({
        where: {
          programId_userId: {
            programId: current.programId,
            userId: current.userId,
          },
        },
        create: {
          programId: current.programId,
          userId: current.userId,
          applicationId: current.id,
          status: "COMPLETED",
          startedAt: current.participation ? undefined : now,
          completedAt: now,
          completionPercent: 100,
        },
        update: {
          status: "COMPLETED",
          completedAt: now,
          completionPercent: 100,
        },
      });
    }

    if (nextStatus === "WITHDRAWN" && current.participation) {
      await tx.learningExperienceParticipation.update({
        where: { id: current.participation.id },
        data: {
          status: "WITHDRAWN",
        },
      });
    }

    return updated;
  });

  return NextResponse.json({ ok: true, application });
}
