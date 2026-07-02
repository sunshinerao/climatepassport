import { NextResponse } from "next/server";
import { z } from "zod";
import { locales, type Locale } from "@/lib/site-content";
import {
  generateClimatePassportId,
  hashUserPassword,
  normalizeUserEmail,
} from "@/lib/server/auth";
import { sanitizeLocalRedirectPath } from "@/lib/redirect-path";
import { createAchievementRecord } from "@/lib/server/achievement-badge";
import { createEmailToken, sendVerificationEmail } from "@/lib/server/auth-email";
import { getPrismaClient } from "@/lib/server/prisma";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/server/rate-limit";

const registerSchema = z.object({
  locale: z.enum(locales).default("en"),
  next: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  salutation: z.string().trim().max(20).optional(),
  title: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(1, "Phone number is required.").max(40),
  country: z.string().trim().min(1, "Country / Region is required.").max(80),
  organizationName: z.string().trim().min(1, "Organization name is required.").max(160),
});

export async function POST(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = registerSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid registration payload." },
      { status: 400 },
    );
  }

  const { locale, next, name, email, password, salutation, title, phone, country, organizationName } = payload.data;
  const normalizedEmail = normalizeUserEmail(email);

  const rateLimit = checkRateLimit(`${getRequestRateLimitKey(request, "auth-register")}:${normalizedEmail}`, {
    limit: 6,
    windowMs: 10 * 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      status: true,
      role: true,
      climatePassportId: true,
      summerSchoolApplications: {
        take: 1,
        select: { id: true },
      },
      notificationPreference: {
        select: { id: true },
      },
    },
  });

  const passwordHash = await hashUserPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    if (existingUser) {
      const isTemporaryProvisionedUser = existingUser.status === "PENDING";

      if (!isTemporaryProvisionedUser) {
        throw new Error("ACCOUNT_EXISTS");
      }

      const resolvedPassportId = existingUser.climatePassportId ?? (await generateClimatePassportId());

      const updated = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name: name.trim(),
          password: passwordHash,
          role: existingUser.role ?? "ATTENDEE",
          status: "ACTIVE",
          emailVerified: null,
          climatePassportId: resolvedPassportId,
          salutation: salutation || null,
          title: title || null,
          phone: phone || null,
          country: country || null,
          organization: {
            upsert: {
              update: { name: organizationName.trim() },
              create: { name: organizationName.trim() },
            },
          },
          ...(existingUser.notificationPreference
            ? {}
            : {
                notificationPreference: {
                  create: {
                    emailEnabled: true,
                    inAppEnabled: true,
                    smsEnabled: false,
                  },
                },
              }),
          notifications: {
            create: {
              channel: "IN_APP",
              status: "DELIVERED",
              kind: "SYSTEM",
              title: "Welcome to Climate Passport",
              titleEn: "Welcome to Climate Passport",
              body: existingUser.summerSchoolApplications.length > 0
                ? "Your account is now fully activated and linked to your Summer School application."
                : "Your Climate Passport account is now fully activated and ready to use.",
              bodyEn:
                existingUser.summerSchoolApplications.length > 0
                  ? "Your account is now fully activated and linked to your Summer School application."
                  : "Your Climate Passport account is now fully activated and ready to use.",
              deliveredAt: new Date(),
            },
          },
        },
        select: {
          id: true,
          role: true,
        },
      });

      await tx.summerSchoolApplication.updateMany({
        where: { userId: existingUser.id },
        data: { climatePassportId: resolvedPassportId },
      });

      return updated;
    }

    const climatePassportId = await generateClimatePassportId();
    return tx.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: passwordHash,
        role: "ATTENDEE",
        status: "ACTIVE",
        emailVerified: null,
        climatePassportId,
        salutation: salutation || null,
        title: title || null,
        phone: phone || null,
        country: country || null,
        organization: {
          create: {
            name: organizationName.trim(),
          },
        },
        notificationPreference: {
          create: {
            emailEnabled: true,
            inAppEnabled: true,
            smsEnabled: false,
          },
        },
        notifications: {
          create: {
            channel: "IN_APP",
            status: "DELIVERED",
            kind: "SYSTEM",
            title: "Welcome to Climate Passport",
            titleEn: "Welcome to Climate Passport",
            body: "Your account is ready. You can now manage participation, certificates, and your Climate Passport archive.",
            bodyEn:
              "Your account is ready. You can now manage participation, certificates, and your Climate Passport archive.",
            deliveredAt: new Date(),
          },
        },
      },
      select: {
        id: true,
        role: true,
      },
    });
  }).catch((error: Error) => {
    if (error.message === "ACCOUNT_EXISTS") {
      return null;
    }
    throw error;
  });

  if (!user) {
    return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
  }

  await createAchievementRecord({
    userId: user.id,
    name: "Climate Passport account activated",
    description: "Account registration completed and profile activated.",
    type: "EVENT",
    sourceType: "USER_SUBMISSION",
    sourceId: `auth-register:${user.id}`,
    verificationLevel: "SYSTEM_RECORDED",
    points: 20,
    completedAt: new Date(),
    skillTags: ["onboarding"],
    topicTags: ["identity"],
    sdgTags: ["SDG13"],
  });

  const token = await createEmailToken({
    userId: user.id,
    email: normalizedEmail,
    purpose: "VERIFY_EMAIL",
  });

  try {
    const origin = new URL(request.url).origin;
    await sendVerificationEmail({
      locale: locale as Locale,
      email: normalizedEmail,
      token: token.token,
      code: token.code,
      origin,
    });
  } catch (error) {
    console.error("[auth/register] failed to send verification email", error);
    return NextResponse.json(
      { error: "Account created, but verification email could not be sent. Please request a new verification email." },
      { status: 502 },
    );
  }

  const fallbackPath = `/${locale}/dashboard/climate-passport`;
  const safeNext = sanitizeLocalRedirectPath(next, fallbackPath);
  const verifyParams = new URLSearchParams({
    email: normalizedEmail,
    next: safeNext,
  });

  return NextResponse.json({
    ok: true,
    redirectTo: `/${locale}/auth/verify-email?${verifyParams.toString()}`,
  });
}
