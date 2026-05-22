import { NextResponse } from "next/server";
import { z } from "zod";
import { locales } from "@/lib/site-content";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const applySchema = z.object({
  locale: z.enum(locales).default("en"),
  fullName: z.string().trim().min(2).max(120),
  preferredName: z.string().trim().max(80).optional(),
  dob: z.string(),
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
  commitment: z.boolean(),
  integrity: z.boolean(),
  passportConsent: z.boolean().optional(),
  passportId: z.string().trim().max(40).optional(),
  projectSlug: z.string(),
  projectType: z.string(),
  applicationStatus: z.string(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json() as unknown;
  const payload = applySchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid application data." },
      { status: 400 },
    );
  }

  const data = payload.data;

  const prisma = getPrismaClient();
  if (prisma) {
    // Store application as a LearningExperience application if matching program exists, 
    // or as a JSON-persisted record. For now we persist to the DB via a LE application.
    // Find or get the summer school program
    const program = await prisma.learningExperienceProgram.findFirst({
      where: { slug: data.projectSlug },
      select: { id: true },
    });

    if (program) {
      // Check for existing application
      const existing = await prisma.learningExperienceApplication.findFirst({
        where: { programId: program.id, userId: user.id },
        select: { id: true, status: true },
      });

      if (existing) {
        return NextResponse.json(
          { error: "You have already applied to this program." },
          { status: 409 },
        );
      }

      await prisma.learningExperienceApplication.create({
        data: {
          programId: program.id,
          userId: user.id,
          status: "SUBMITTED",
          answersJson: data as object,
        },
      });
    }
    // If no matching program, we accept gracefully and the admin handles it offline
  }

  return NextResponse.json({ ok: true });
}
