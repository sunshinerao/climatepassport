import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { locales } from "@/lib/site-content";
import {
  generateClimatePassportId,
  hashUserPassword,
  normalizeUserEmail,
} from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const applySchema = z.object({
  locale: z.enum(locales).default("en"),
  fullName: z.string().trim().min(2).max(120),
  preferredName: z.string().trim().max(80).optional(),
  dob: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/, "Date of birth must be YYYY-MM-DD or MM/DD/YYYY."),
  nationality: z.string().trim().max(80),
  school: z.string().trim().max(160),
  grade: z.string().trim().max(40),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional(),
  guardianName: z.string().trim().max(120),
  guardianEmail: z.string().trim().email(),
  guardianPhone: z.string().trim().max(40).optional(),
  channel: z.string().trim().max(40).optional(),
  explorationStage: z.string().trim().max(4),
  coreIssue: z.string().trim().max(3000),
  practiceProof: z.string().trim().max(2000).optional(),
  portfolioUrl: z.string().trim().max(400).optional(),
  aiRole: z.string().trim().max(4),
  aiTools: z.string().trim().max(200).optional(),
  aiBlindspot: z.string().trim().max(2000).optional(),
  expectation: z.string().trim().max(3000),
  futurePath: z.array(z.string()).optional(),
  languageComfort: z.string().trim().max(40).optional(),
  travelCommitment: z.string().trim().max(40).optional(),
  financialAid: z.string().trim().max(4).optional(),
  financialAidNote: z.string().trim().max(1000).optional(),
  commitment: z.literal(true),
  integrity: z.literal(true),
  passportConsent: z.literal(true),
  passportId: z.string().trim().max(40).optional(),
  projectSlug: z.string(),
  projectType: z.string(),
  applicationStatus: z.string(),
});

export async function POST(request: Request) {
  const body = await request.json() as unknown;
  const payload = applySchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid application data." },
      { status: 400 },
    );
  }

  const data = payload.data;
  const normalizedEmail = normalizeUserEmail(data.email);

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.summerSchoolApplication.findUnique({
        where: {
          projectSlug_email: {
            projectSlug: data.projectSlug,
            email: normalizedEmail,
          },
        },
        select: { id: true },
      });

      if (duplicate) {
        return { duplicate: true as const };
      }

      let user = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          climatePassportId: true,
          role: true,
          status: true,
        },
      });

      if (!user) {
        const [passwordHash, climatePassportId] = await Promise.all([
          hashUserPassword(randomBytes(24).toString("hex")),
          generateClimatePassportId(),
        ]);

        user = await tx.user.create({
          data: {
            name: data.fullName.trim(),
            email: normalizedEmail,
            password: passwordHash,
            role: "ATTENDEE",
            status: "PENDING",
            climatePassportId,
            phone: data.phone || null,
            country: data.nationality || null,
            notificationPreference: {
              create: {
                emailEnabled: true,
                inAppEnabled: true,
                smsEnabled: false,
              },
            },
          },
          select: {
            id: true,
            climatePassportId: true,
            role: true,
            status: true,
          },
        });
      } else if (!user.climatePassportId) {
        const climatePassportId = await generateClimatePassportId();
        user = await tx.user.update({
          where: { id: user.id },
          data: { climatePassportId },
          select: {
            id: true,
            climatePassportId: true,
            role: true,
            status: true,
          },
        });
      }

      const program = await tx.learningExperienceProgram.findFirst({
        where: { slug: data.projectSlug },
        select: { id: true },
      });

      let learningApplicationId: string | null = null;

      if (program) {
        const existingLearningApplication = await tx.learningExperienceApplication.findUnique({
          where: {
            programId_userId: {
              programId: program.id,
              userId: user.id,
            },
          },
          select: { id: true },
        });

        if (existingLearningApplication) {
          learningApplicationId = existingLearningApplication.id;
        } else {
          const learningApplication = await tx.learningExperienceApplication.create({
            data: {
              programId: program.id,
              userId: user.id,
              status: "SUBMITTED",
              submittedAt: new Date(),
              answersJson: data as object,
            },
            select: { id: true },
          });
          learningApplicationId = learningApplication.id;
        }
      }

      await tx.summerSchoolApplication.create({
        data: {
          projectSlug: data.projectSlug,
          projectType: data.projectType,
          applicationStatus: data.applicationStatus,
          locale: data.locale,
          email: normalizedEmail,
          fullName: data.fullName,
          preferredName: data.preferredName || null,
          phone: data.phone || null,
          guardianName: data.guardianName || null,
          guardianEmail: data.guardianEmail || null,
          guardianPhone: data.guardianPhone || null,
          channel: data.channel || null,
          climatePassportId: user.climatePassportId ?? user.id,
          userId: user.id,
          learningExperienceProgramId: program?.id ?? null,
          learningExperienceApplicationId: learningApplicationId,
          answersJson: data as object,
          submittedAt: new Date(),
        },
      });

      return {
        duplicate: false as const,
        climatePassportId: user.climatePassportId,
      };
    });

    if (result.duplicate) {
      return NextResponse.json(
        { error: "An application already exists for this email and project." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, climatePassportId: result.climatePassportId });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An application already exists for this email and project." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to submit application." }, { status: 500 });
  }
}
