import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { normalizeUserEmail } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  const url = new URL(request.url);
  const emailRaw = url.searchParams.get("email") ?? "";
  const passportIdRaw = url.searchParams.get("passportId") ?? "";
  const email = normalizeUserEmail(emailRaw);
  const passportId = passportIdRaw.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !passportId) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  const application = await prisma.summerSchoolApplication.findFirst({
    where: {
      projectSlug: "gca-yungu-summer-school-2026",
      email,
      climatePassportId: passportId,
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      fullName: true,
      preferredName: true,
      email: true,
      phone: true,
      guardianName: true,
      guardianEmail: true,
      guardianPhone: true,
      climatePassportId: true,
      answersJson: true,
    },
  });

  if (!application) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      found: true,
      application: {
        ...application,
        answersJson: (application.answersJson ?? null) as Record<string, unknown> | null,
      },
    },
    { status: 200 },
  );
}
