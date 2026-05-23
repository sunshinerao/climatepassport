import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = (url.searchParams.get("locale") ?? "en") as "zh" | "en";

  await requireRoleAccess(locale, ["ADMIN"], `/${locale}/admin`);

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const rows = await prisma.summerSchoolApplication.findMany({
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      preferredName: true,
      phone: true,
      guardianName: true,
      guardianEmail: true,
      guardianPhone: true,
      channel: true,
      climatePassportId: true,
      projectSlug: true,
      applicationStatus: true,
      locale: true,
      answersJson: true,
      submittedAt: true,
    },
  });

  return NextResponse.json({ rows });
}
