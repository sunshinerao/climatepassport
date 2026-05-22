import { NextResponse } from "next/server";
import {
  learningProgramSchema,
  serializeLearningProgram,
} from "@/lib/server/admin-learning-experiences";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireRoleAccess("en", ["ADMIN", "EVENT_MANAGER"], "/en/admin/learning-experiences");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const existing = await prisma.learningExperienceProgram.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      managerUserId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  if (user.role === "EVENT_MANAGER" && existing.managerUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = learningProgramSchema.partial().safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const managerUserId =
    user.role === "EVENT_MANAGER"
      ? user.id
      : payload.data.managerUserId === undefined
        ? existing.managerUserId
        : payload.data.managerUserId || null;

  const updateData: Record<string, unknown> = {};

  if (payload.data.slug !== undefined) {
    updateData.slug = payload.data.slug;
  }
  if (payload.data.title !== undefined) {
    updateData.title = payload.data.title;
  }
  if (payload.data.titleEn !== undefined) {
    updateData.titleEn = payload.data.titleEn || null;
  }
  if (payload.data.summary !== undefined) {
    updateData.summary = payload.data.summary || null;
  }
  if (payload.data.summaryEn !== undefined) {
    updateData.summaryEn = payload.data.summaryEn || null;
  }
  if (payload.data.description !== undefined) {
    updateData.description = payload.data.description || null;
  }
  if (payload.data.descriptionEn !== undefined) {
    updateData.descriptionEn = payload.data.descriptionEn || null;
  }
  if (payload.data.location !== undefined) {
    updateData.location = payload.data.location || null;
  }
  if (payload.data.locationEn !== undefined) {
    updateData.locationEn = payload.data.locationEn || null;
  }
  if (payload.data.categoryId !== undefined) {
    updateData.categoryId = payload.data.categoryId;
  }
  if (payload.data.certificateDefinitionId !== undefined) {
    updateData.certificateDefinitionId = payload.data.certificateDefinitionId || null;
  }
  if (payload.data.applicationOpenAt !== undefined) {
    updateData.applicationOpenAt = payload.data.applicationOpenAt
      ? new Date(payload.data.applicationOpenAt)
      : null;
  }
  if (payload.data.applicationCloseAt !== undefined) {
    updateData.applicationCloseAt = payload.data.applicationCloseAt
      ? new Date(payload.data.applicationCloseAt)
      : null;
  }
  if (payload.data.cohortStartAt !== undefined) {
    updateData.cohortStartAt = payload.data.cohortStartAt
      ? new Date(payload.data.cohortStartAt)
      : null;
  }
  if (payload.data.cohortEndAt !== undefined) {
    updateData.cohortEndAt = payload.data.cohortEndAt
      ? new Date(payload.data.cohortEndAt)
      : null;
  }
  if (payload.data.capacity !== undefined) {
    updateData.capacity = payload.data.capacity;
  }
  if (payload.data.pointReward !== undefined) {
    updateData.pointReward = payload.data.pointReward;
  }
  if (payload.data.status !== undefined) {
    updateData.status = payload.data.status;
  }
  if (payload.data.isPublished !== undefined) {
    updateData.isPublished = payload.data.isPublished;
  }
  if (payload.data.applicationSchemaJson !== undefined) {
    updateData.applicationSchemaJson =
      payload.data.applicationSchemaJson == null ? undefined : payload.data.applicationSchemaJson;
  }
  if (payload.data.programConfigJson !== undefined) {
    updateData.programConfigJson =
      payload.data.programConfigJson == null ? undefined : payload.data.programConfigJson;
  }

  updateData.managerUserId = managerUserId;

  const program = await prisma.learningExperienceProgram.update({
    where: { id: params.id },
    data: updateData,
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
