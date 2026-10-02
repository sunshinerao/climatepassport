import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiRole } from "@/lib/server/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = (url.searchParams.get("locale") ?? "en") as "zh" | "en";

  const apiAuth = await requireApiRole(["ADMIN"], request);
  if (apiAuth instanceof NextResponse) return apiAuth;

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
