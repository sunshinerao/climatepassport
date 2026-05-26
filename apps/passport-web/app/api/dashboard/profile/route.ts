import { NextResponse } from "next/server";
import { z } from "zod";
import { createAchievementRecord } from "@/lib/server/achievement-badge";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

function isValidOrganizationWebsite(value: string) {
  try {
    const url = new URL(value);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const hostname = url.hostname.trim();
    const hasValidHost = hostname === "localhost" || hostname.includes(".");
    return isHttp && hasValidHost;
  } catch {
    return false;
  }
}

const organizationSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required.").max(140),
  website: z
    .string()
    .trim()
    .max(240)
    .refine((value) => {
      if (!value) {
        return true;
      }

      return isValidOrganizationWebsite(value);
    }, "Organization website must be a valid HTTP/HTTPS URL with a valid host.")
    .optional()
    .nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

const profileSchema = z.object({
  salutation: z.string().trim().max(40).optional().nullable(),
  phone: z.string().trim().min(1, "Phone is required.").max(50),
  country: z.string().trim().min(1, "Country / Region is required.").max(80),
  title: z.string().trim().max(120).optional().nullable(),
  avatar: z.string().trim().max(800000).optional().nullable(),
  bio: z.string().trim().max(2000).optional().nullable(),
  organization: organizationSchema,
});

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const next = value.trim();
  return next.length > 0 ? next : null;
}

export async function PATCH(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/profile");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = profileSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const normalized = {
    salutation: normalizeOptionalText(payload.data.salutation),
    phone: normalizeOptionalText(payload.data.phone),
    country: normalizeOptionalText(payload.data.country),
    title: normalizeOptionalText(payload.data.title),
    avatar: normalizeOptionalText(payload.data.avatar),
    bio: normalizeOptionalText(payload.data.bio),
    organization: {
      name: normalizeOptionalText(payload.data.organization.name),
      website: normalizeOptionalText(payload.data.organization.website),
      description: normalizeOptionalText(payload.data.organization.description),
    },
  };

  if (!normalized.organization.name) {
    return NextResponse.json(
      { error: "Organization name is required." },
      { status: 400 },
    );
  }

  const requiredOrganizationName = normalized.organization.name;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        salutation: normalized.salutation,
        phone: normalized.phone,
        country: normalized.country,
        title: normalized.title,
        avatar: normalized.avatar,
        bio: normalized.bio,
      },
    });

    await tx.organization.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: requiredOrganizationName,
        website: normalized.organization.website,
        description: normalized.organization.description,
      },
      update: {
        name: requiredOrganizationName,
        website: normalized.organization.website,
        description: normalized.organization.description,
      },
    });
  });

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      salutation: true,
      phone: true,
      country: true,
      title: true,
      avatar: true,
      bio: true,
      climatePassportId: true,
      passCode: true,
      organization: {
        select: {
          name: true,
          website: true,
          description: true,
        },
      },
    },
  });

  await createAchievementRecord({
    userId: user.id,
    name: "Profile baseline completed",
    description: "Completed and saved baseline profile information.",
    type: "VERIFIED",
    sourceType: "SYSTEM_EVENT",
    sourceId: `profile-baseline:${user.id}`,
    verificationLevel: "SYSTEM_RECORDED",
    points: 10,
    completedAt: new Date(),
    skillTags: ["profile"],
    topicTags: ["identity"],
    sdgTags: ["SDG17"],
  });

  return NextResponse.json({ ok: true, profile: updated });
}
