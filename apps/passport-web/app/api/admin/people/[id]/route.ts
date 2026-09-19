import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { normalizeSlug, personUpdateSchema, serializePerson } from "@/lib/server/people-master-data";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/people");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const person = await prisma.person.findUnique({
    where: { id: params.id },
    include: {
      affiliations: {
        orderBy: [{ isCurrent: "desc" }, { order: "asc" }, { createdAt: "desc" }],
        include: { institution: { select: { id: true, name: true, slug: true } } },
      },
      roleProfiles: {
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: { scopeInstitution: { select: { id: true, name: true, slug: true } } },
      },
      speakers: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, nameEn: true } },
      user: { select: { id: true, email: true, name: true } },
      _count: { select: { affiliations: true, roleProfiles: true, speakers: true } },
    },
  });

  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  return NextResponse.json({ person: serializePerson(person) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRoleAccess("en", ["ADMIN"], "/en/admin/people");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.person.findUnique({ where: { id: params.id }, select: { id: true, slug: true } });
  if (!existing) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = personUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.slug !== undefined) {
    const slug = normalizeSlug(data.slug ?? "");
    if (data.slug && !slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    if (slug && slug !== existing.slug) {
      const taken = await prisma.person.findUnique({ where: { slug } });
      if (taken) return NextResponse.json({ error: "Person slug already exists" }, { status: 409 });
    }
    data.slug = slug || undefined;
  }

  if (data.userId) {
    const linkedUser = await prisma.user.findUnique({ where: { id: data.userId }, select: { id: true } });
    if (!linkedUser) return NextResponse.json({ error: "Linked user not found" }, { status: 404 });
    const existingLink = await prisma.person.findUnique({ where: { userId: data.userId } });
    if (existingLink && existingLink.id !== params.id) {
      return NextResponse.json({ error: "User already linked to another person" }, { status: 409 });
    }
  }

  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    updateData[key] = key === "verificationMetadata" ? (value as Prisma.InputJsonValue) : value;
  }

  const person = await prisma.person.update({
    where: { id: params.id },
    data: updateData as Prisma.PersonUpdateInput,
    include: {
      _count: { select: { affiliations: true, roleProfiles: true, speakers: true } },
    },
  });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "PERSON_UPDATE",
    subjectType: "Person",
    subjectId: person.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { updatedFields: Object.keys(updateData) },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, person: serializePerson(person) });
}
