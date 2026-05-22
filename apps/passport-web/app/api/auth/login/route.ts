import { NextResponse } from "next/server";
import { z } from "zod";
import { locales, type Locale } from "@/lib/site-content";
import {
  createUserSession,
  getDashboardPathForRole,
  normalizeUserEmail,
  verifyUserPassword,
} from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const loginSchema = z.object({
  locale: z.enum(locales).default("en"),
  next: z.string().optional(),
  email: z.string().trim().email(),
  password: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = loginSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid login payload." },
      { status: 400 },
    );
  }

  const { locale, next, email, password } = payload.data;
  const normalizedEmail = normalizeUserEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      password: true,
      role: true,
      status: true,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const passwordMatches = await verifyUserPassword(user.password, password);

  if (!passwordMatches) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createUserSession(user.id);

  return NextResponse.json({
    ok: true,
    redirectTo: next || getDashboardPathForRole(locale as Locale, user.role),
  });
}
