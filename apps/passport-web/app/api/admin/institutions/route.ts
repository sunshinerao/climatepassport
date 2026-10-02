import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import {
  buildInstitutionWhere,
  institutionCreateSchema,
  institutionListQuerySchema,
  normalizeSlug,
  serializeInstitution,
} from "@/lib/server/people-master-data";
import { requireApiRole } from "@/lib/server/api-auth";

export async function GET(req: NextRequest) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const parsed = institutionListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    verificationStatus: searchParams.get("verificationStatus") ?? undefined,
    isActive: searchParams.get("isActive") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const query = parsed.data;
  const where = buildInstitutionWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [institutions, total] = await Promise.all([
    prisma.institution.findMany({
      where,
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      skip,
      take: query.pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        nameEn: true,
        shortName: true,
        shortNameEn: true,
        legalName: true,
        aliases: true,
        orgType: true,
        governanceType: true,
        countryOrRegion: true,
        countryOrRegionEn: true,
        website: true,
        verificationStatus: true,
        isActive: true,
      },
    }),
    prisma.institution.count({ where }),
  ]);

  return NextResponse.json({
    institutions: institutions.map(serializeInstitution),
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
  const parsed = institutionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  const slug = normalizeSlug(data.slug);
  if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

  const exists = await prisma.institution.findUnique({ where: { slug } });
  if (exists) return NextResponse.json({ error: "Institution slug already exists" }, { status: 409 });

  const institution = await prisma.institution.create({
    data: {
      slug,
      name: data.name,
      nameEn: data.nameEn ?? null,
      shortName: data.shortName ?? null,
      shortNameEn: data.shortNameEn ?? null,
      legalName: data.legalName ?? null,
      aliases: data.aliases,
      orgType: data.orgType ?? null,
      governanceType: data.governanceType ?? null,
      countryOrRegion: data.countryOrRegion ?? null,
      countryOrRegionEn: data.countryOrRegionEn ?? null,
      website: data.website ?? null,
      verificationStatus: data.verificationStatus ?? "UNVERIFIED",
      publicContactEmail: data.publicContactEmail ?? null,
      publicContactPhone: data.publicContactPhone ?? null,
      headquartersAddress: data.headquartersAddress ?? null,
      foundingYear: data.foundingYear ?? null,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      nameEn: true,
      shortName: true,
      shortNameEn: true,
      legalName: true,
      aliases: true,
      orgType: true,
      governanceType: true,
      countryOrRegion: true,
      countryOrRegionEn: true,
      website: true,
      verificationStatus: true,
      isActive: true,
    },
  });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "INSTITUTION_CREATE",
    subjectType: "Institution",
    subjectId: institution.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { slug, verificationStatus: institution.verificationStatus },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, institution: serializeInstitution(institution) }, { status: 201 });
}
