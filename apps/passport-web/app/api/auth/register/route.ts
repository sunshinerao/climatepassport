import { NextResponse } from "next/server";
import { z } from "zod";
import { locales, type Locale } from "@/lib/site-content";
import {
  createUserSession,
  generateClimatePassportId,
  getDashboardPathForRole,
  hashUserPassword,
  normalizeUserEmail,
} from "@/lib/server/auth";
import { sanitizeLocalRedirectPath } from "@/lib/redirect-path";
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
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  organizationName: z.string().trim().max(160).optional(),
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
          climatePassportId: resolvedPassportId,
          salutation: salutation || null,
          title: title || null,
          phone: phone || null,
          country: country || null,
          ...(organizationName
            ? {
                organization: {
                  upsert: {
                    update: { name: organizationName.trim() },
                    create: { name: organizationName.trim() },
                  },
                },
              }
            : {}),
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
        climatePassportId,
        salutation: salutation || null,
        title: title || null,
        phone: phone || null,
        country: country || null,
        ...(organizationName
          ? {
              organization: {
                create: {
                  name: organizationName.trim(),
                },
              },
            }
          : {}),
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

  await createUserSession(user.id);

  const fallbackPath = getDashboardPathForRole(locale as Locale, user.role);

  return NextResponse.json({
    ok: true,
    redirectTo: sanitizeLocalRedirectPath(next, fallbackPath),
  });
}
