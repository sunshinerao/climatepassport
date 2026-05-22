import { z } from "zod";
import {
  learningApplicationStatusOptions,
  learningProgramStatusOptions,
} from "@/lib/learning-experiences";

export { learningApplicationStatusOptions, learningProgramStatusOptions };

export const learningProgramSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(180),
  titleEn: z.string().trim().max(180).optional(),
  summary: z.string().trim().max(4000).optional(),
  summaryEn: z.string().trim().max(4000).optional(),
  description: z.string().trim().max(12000).optional(),
  descriptionEn: z.string().trim().max(12000).optional(),
  location: z.string().trim().max(160).optional(),
  locationEn: z.string().trim().max(160).optional(),
  categoryId: z.string().trim().min(1),
  managerUserId: z.string().trim().optional(),
  certificateDefinitionId: z.string().trim().optional(),
  applicationOpenAt: z.string().datetime().optional(),
  applicationCloseAt: z.string().datetime().optional(),
  cohortStartAt: z.string().datetime().optional(),
  cohortEndAt: z.string().datetime().optional(),
  capacity: z.number().int().positive().max(100000).optional(),
  pointReward: z.number().int().min(0).max(100000).optional(),
  status: z.enum(learningProgramStatusOptions).default("DRAFT"),
  isPublished: z.boolean().default(false),
  applicationSchemaJson: z.unknown().optional(),
  programConfigJson: z.unknown().optional(),
});

export function serializeLearningProgram(program: {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  summary: string | null;
  summaryEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  location: string | null;
  locationEn: string | null;
  categoryId: string;
  category?: { name: string; nameEn: string | null } | null;
  managerUserId: string | null;
  manager?: { name: string } | null;
  certificateDefinitionId: string | null;
  applicationOpenAt: Date | null;
  applicationCloseAt: Date | null;
  cohortStartAt: Date | null;
  cohortEndAt: Date | null;
  capacity: number | null;
  pointReward: number | null;
  status: string;
  isPublished: boolean;
  _count?: { applications?: number; participations?: number };
}) {
  return {
    id: program.id,
    slug: program.slug,
    title: program.title,
    titleEn: program.titleEn,
    summary: program.summary,
    summaryEn: program.summaryEn,
    description: program.description,
    descriptionEn: program.descriptionEn,
    location: program.location,
    locationEn: program.locationEn,
    categoryId: program.categoryId,
    categoryName: program.category?.name ?? null,
    categoryNameEn: program.category?.nameEn ?? null,
    managerUserId: program.managerUserId,
    managerName: program.manager?.name ?? null,
    certificateDefinitionId: program.certificateDefinitionId,
    applicationOpenAt: program.applicationOpenAt?.toISOString() ?? null,
    applicationCloseAt: program.applicationCloseAt?.toISOString() ?? null,
    cohortStartAt: program.cohortStartAt?.toISOString() ?? null,
    cohortEndAt: program.cohortEndAt?.toISOString() ?? null,
    capacity: program.capacity,
    pointReward: program.pointReward,
    status: program.status,
    isPublished: program.isPublished,
    applicationCount: program._count?.applications ?? 0,
    participationCount: program._count?.participations ?? 0,
  };
}

export function buildLearningProgramWriteData(
  payload: z.infer<typeof learningProgramSchema>,
  managerUserId: string | null,
) {
  return {
    slug: payload.slug,
    title: payload.title,
    titleEn: payload.titleEn || null,
    summary: payload.summary || null,
    summaryEn: payload.summaryEn || null,
    description: payload.description || null,
    descriptionEn: payload.descriptionEn || null,
    location: payload.location || null,
    locationEn: payload.locationEn || null,
    categoryId: payload.categoryId,
    managerUserId,
    certificateDefinitionId: payload.certificateDefinitionId || null,
    applicationOpenAt: payload.applicationOpenAt ? new Date(payload.applicationOpenAt) : null,
    applicationCloseAt: payload.applicationCloseAt ? new Date(payload.applicationCloseAt) : null,
    cohortStartAt: payload.cohortStartAt ? new Date(payload.cohortStartAt) : null,
    cohortEndAt: payload.cohortEndAt ? new Date(payload.cohortEndAt) : null,
    capacity: payload.capacity ?? null,
    pointReward: payload.pointReward ?? null,
    status: payload.status,
    isPublished: payload.isPublished,
    applicationSchemaJson:
      payload.applicationSchemaJson == null ? undefined : payload.applicationSchemaJson,
    programConfigJson:
      payload.programConfigJson == null ? undefined : payload.programConfigJson,
  };
}
