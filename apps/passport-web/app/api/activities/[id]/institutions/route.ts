import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const institutions = await prisma.activityInstitution.findMany({
    where: { activityId: params.id },
    include: {
      institution: {
        select: { id: true, name: true, nameEn: true, logo: true, website: true },
      },
    },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ institutions });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const institutionId = body.institutionId as string | undefined;
  const role = body.role as string | undefined;
  const roleEn = body.roleEn as string | undefined;

  if (!institutionId) {
    return NextResponse.json({ error: "institutionId is required" }, { status: 400 });
  }

  const existing = await prisma.activityInstitution.findUnique({
    where: {
      activityId_institutionId: {
        activityId: params.id,
        institutionId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Institution already linked" }, { status: 409 });
  }

  const link = await prisma.activityInstitution.create({
    data: {
      activityId: params.id,
      institutionId,
      role: role || null,
      roleEn: roleEn || null,
    },
    include: {
      institution: {
        select: { id: true, name: true, nameEn: true, logo: true },
      },
    },
  });

  return NextResponse.json({ ok: true, institution: link });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId");

  if (!institutionId) {
    return NextResponse.json({ error: "institutionId is required" }, { status: 400 });
  }

  const existing = await prisma.activityInstitution.findUnique({
    where: {
      activityId_institutionId: {
        activityId: params.id,
        institutionId,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Institution link not found" }, { status: 404 });
  }

  await prisma.activityInstitution.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
