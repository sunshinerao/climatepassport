import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { affiliationCreateSchema } from "@/lib/server/people-master-data";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/people");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const person = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const affiliations = await prisma.personAffiliation.findMany({
    where: { personId: params.id },
    orderBy: [{ isCurrent: "desc" }, { order: "asc" }, { createdAt: "desc" }],
    include: { institution: { select: { id: true, name: true, slug: true } } },
  });

  return NextResponse.json({ affiliations });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRoleAccess("en", ["ADMIN"], "/en/admin/people");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const person = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = affiliationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.institutionId) {
    const institution = await prisma.institution.findUnique({ where: { id: data.institutionId }, select: { id: true } });
    if (!institution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }

  if (!data.institutionId && !data.organizationName) {
    return NextResponse.json({ error: "Provide institutionId or organizationName" }, { status: 400 });
  }

  const affiliation = await prisma.personAffiliation.create({
    data: {
      personId: params.id,
      institutionId: data.institutionId ?? null,
      organizationName: data.organizationName ?? null,
      organizationNameEn: data.organizationNameEn ?? null,
      department: data.department ?? null,
      title: data.title ?? null,
      titleEn: data.titleEn ?? null,
      startYear: data.startYear ?? null,
      endYear: data.endYear ?? null,
      isCurrent: data.isCurrent ?? false,
      status: data.status ?? "ACTIVE",
      order: data.order,
    },
    include: { institution: { select: { id: true, name: true, slug: true } } },
  });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "PERSON_AFFILIATION_CREATE",
    subjectType: "PersonAffiliation",
    subjectId: affiliation.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { personId: params.id, institutionId: data.institutionId },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, affiliation }, { status: 201 });
}
