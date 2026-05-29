import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get("activityId") ?? undefined;

  if (!activityId) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const rules = await prisma.activityCertificateRule.findMany({
    where: { activityId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { activityId, certificateDefinitionId, conditionJson, autoIssue } = body;

  if (!activityId || !certificateDefinitionId) {
    return NextResponse.json({ error: "Missing required fields: activityId, certificateDefinitionId" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const rule = await prisma.activityCertificateRule.create({
    data: {
      activityId,
      certificateDefinitionId,
      conditionJson,
      autoIssue: autoIssue ?? false,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
