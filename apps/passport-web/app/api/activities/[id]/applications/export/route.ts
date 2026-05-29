import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

function escapeCsv(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { activityId: params.id };
  if (status) {
    where.status = status;
  }

  const applications = await prisma.activityApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const userIds = [...new Set(applications.map((a) => a.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      email: true,
      climatePassportId: true,
      phone: true,
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    select: { title: true, titleEn: true },
  });

  const headers = [
    "Name",
    "Email",
    "Climate Passport ID",
    "Phone",
    "Role Type",
    "Status",
    "Submitted At",
    "Reviewed At",
    "Review Comment",
  ];

  const rows = applications.map((app) => {
    const user = userMap.get(app.userId);
    return [
      user?.name || "",
      user?.email || "",
      user?.climatePassportId || "",
      user?.phone || "",
      app.roleType || "",
      app.status,
      app.submittedAt ? new Date(app.submittedAt).toISOString() : "",
      app.reviewedAt ? new Date(app.reviewedAt).toISOString() : "",
      app.reviewComment || "",
    ];
  });

  const csv = [headers.join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join("\n");

  const filename = `${activity?.title || "activity"}_applications_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
