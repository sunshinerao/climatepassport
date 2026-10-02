import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiRole } from "@/lib/server/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const templates = await prisma.activityFormTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole(["ADMIN"], req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { name, type, fieldsJson } = body;

  if (!name || !type || fieldsJson === undefined) {
    return NextResponse.json({ error: "Missing required fields: name, type, fieldsJson" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const template = await prisma.activityFormTemplate.create({
    data: { name, type, fieldsJson, createdByUserId: auth.id },
  });

  return NextResponse.json({ template }, { status: 201 });
}
