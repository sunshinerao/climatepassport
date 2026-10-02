import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { roleProfileCreateSchema } from "@/lib/server/people-master-data";
import { requireApiRole } from "@/lib/server/api-auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const apiAuth = await requireApiRole(["ADMIN"], req);
  if (apiAuth instanceof NextResponse) return apiAuth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const person = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const roleProfiles = await prisma.personRoleProfile.findMany({
    where: { personId: params.id },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: { scopeInstitution: { select: { id: true, name: true, slug: true } } },
  });

  return NextResponse.json({ roleProfiles });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const person = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = roleProfileCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.scopeInstitutionId) {
    const institution = await prisma.institution.findUnique({ where: { id: data.scopeInstitutionId }, select: { id: true } });
    if (!institution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }

  const roleProfile = await prisma.personRoleProfile.create({
    data: {
      personId: params.id,
      roleType: data.roleType,
      roleTitle: data.roleTitle ?? null,
      roleTitleEn: data.roleTitleEn ?? null,
      scopeInstitutionId: data.scopeInstitutionId ?? null,
      isPrimary: data.isPrimary ?? false,
      isVisible: data.isVisible ?? true,
      startYear: data.startYear ?? null,
      endYear: data.endYear ?? null,
      order: data.order,
    },
    include: { scopeInstitution: { select: { id: true, name: true, slug: true } } },
  });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "PERSON_ROLE_PROFILE_CREATE",
    subjectType: "PersonRoleProfile",
    subjectId: roleProfile.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { personId: params.id, roleType: data.roleType },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, roleProfile }, { status: 201 });
}
