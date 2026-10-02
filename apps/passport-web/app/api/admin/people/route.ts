import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import {
  buildPersonWhere,
  normalizeSlug,
  personCreateSchema,
  personListQuerySchema,
  serializePerson,
} from "@/lib/server/people-master-data";
import { requireApiRole } from "@/lib/server/api-auth";

export async function GET(req: NextRequest) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const parsed = personListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    verificationStatus: searchParams.get("verificationStatus") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const query = parsed.data;
  const where = buildPersonWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [people, total] = await Promise.all([
    prisma.person.findMany({
      where,
      orderBy: [{ displayName: "asc" }, { createdAt: "desc" }],
      skip,
      take: query.pageSize,
      include: {
        _count: { select: { affiliations: true, roleProfiles: true, speakers: true } },
      },
    }),
    prisma.person.count({ where }),
  ]);

  return NextResponse.json({
    people: people.map(serializePerson),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const parsed = personCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.slug) {
    const slug = normalizeSlug(data.slug);
    if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    const existing = await prisma.person.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "Person slug already exists" }, { status: 409 });
    data.slug = slug;
  }

  if (data.userId) {
    const linkedUser = await prisma.user.findUnique({ where: { id: data.userId }, select: { id: true } });
    if (!linkedUser) return NextResponse.json({ error: "Linked user not found" }, { status: 404 });
    const existingPerson = await prisma.person.findUnique({ where: { userId: data.userId } });
    if (existingPerson) return NextResponse.json({ error: "User already linked to a person" }, { status: 409 });
  }

  const person = await prisma.person.create({
    data: {
      slug: data.slug ?? null,
      displayName: data.displayName,
      displayNameEn: data.displayNameEn ?? null,
      salutation: data.salutation ?? null,
      title: data.title ?? null,
      titleEn: data.titleEn ?? null,
      bio: data.bio ?? null,
      bioEn: data.bioEn ?? null,
      countryOrRegion: data.countryOrRegion ?? null,
      countryOrRegionEn: data.countryOrRegionEn ?? null,
      avatar: data.avatar ?? null,
      website: data.website ?? null,
      linkedin: data.linkedin ?? null,
      twitter: data.twitter ?? null,
      orcid: data.orcid ?? null,
      isPublic: data.isPublic ?? false,
      verificationStatus: data.verificationStatus ?? "DRAFT",
      verificationMetadata: (data.verificationMetadata ?? undefined) as Prisma.InputJsonValue | undefined,
      userId: data.userId ?? null,
    },
    include: {
      _count: { select: { affiliations: true, roleProfiles: true, speakers: true } },
    },
  });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "PERSON_CREATE",
    subjectType: "Person",
    subjectId: person.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { verificationStatus: person.verificationStatus, userLinked: Boolean(person.userId) },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, person: serializePerson(person) }, { status: 201 });
}
