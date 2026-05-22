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
import { getPrismaClient } from "@/lib/server/prisma";

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
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
  }

  const [passwordHash, climatePassportId] = await Promise.all([
    hashUserPassword(password),
    generateClimatePassportId(),
  ]);

  const user = await prisma.user.create({
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

  await createUserSession(user.id);

  return NextResponse.json({
    ok: true,
    redirectTo: next || getDashboardPathForRole(locale as Locale, user.role),
  });
}
