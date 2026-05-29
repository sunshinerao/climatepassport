import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const templates = await prisma.activityFormTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { name, type, fieldsJson, createdByUserId } = body;

  if (!name || !type || fieldsJson === undefined || !createdByUserId) {
    return NextResponse.json({ error: "Missing required fields: name, type, fieldsJson, createdByUserId" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const template = await prisma.activityFormTemplate.create({
    data: { name, type, fieldsJson, createdByUserId },
  });

  return NextResponse.json({ template }, { status: 201 });
}
