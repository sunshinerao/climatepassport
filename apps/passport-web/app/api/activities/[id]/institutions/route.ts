import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { requireApiRole } from "@/lib/server/api-auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { assertActivityScopeAccess } from "@/lib/server/programme-scope";
import { canManageActivity } from "@/lib/server/verifier-activity";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  // CP-TODO-241: activities bound to a programme scope require scoped read access;
  // unscoped legacy activities keep their existing public behavior.
  const session = await getCurrentSession();
  const scopeCheck = await assertActivityScopeAccess(prisma, session?.user ?? null, params.id, "read");
  if (!scopeCheck.ok) return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status });

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
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (!(await canManageActivity(prisma, auth, params.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // CP-TODO-241: scoped activities additionally require write access inside their programme scope.
  const scopeCheck = await assertActivityScopeAccess(prisma, auth, params.id, "write");
  if (!scopeCheck.ok) return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status });

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
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (!(await canManageActivity(prisma, auth, params.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
