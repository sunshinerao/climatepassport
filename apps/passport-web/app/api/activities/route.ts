import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { tryGenerateHighlightsAfterSave } from "@/lib/server/activity-highlights";

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const where = {
    ...(status ? { status: status as any } : {}),
    ...(type ? { type: type as any } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { titleEn: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, activities] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        titleEn: true,
        slug: true,
        status: true,
        visibility: true,
        startTime: true,
        endTime: true,
        locationType: true,
        isFeatured: true,
        capacity: true,
        createdAt: true,
        _count: {
          select: {
            applications: true,
            participations: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({ activities, total, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const {
    type,
    title,
    titleEn,
    subtitle,
    subtitleEn,
    slug,
    category,
    coverImage,
    summary,
    summaryEn,
    description,
    descriptionEn,
    organizerUserId,
    organizerName,
    partnerIds,
    startTime,
    endTime,
    timezone,
    locationType,
    locationJson,
    onlineUrl,
    status,
    visibility,
    capacity,
    registrationOpenAt,
    registrationCloseAt,
    requiresApproval,
    isFeatured,
    language,
    tags,
    createdByUserId,
  } = body;

  if (!type || !title || !slug || !createdByUserId) {
    return NextResponse.json({ error: "Missing required fields: type, title, slug, createdByUserId" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.activity.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  }

  const activity = await prisma.activity.create({
    data: {
      type,
      title,
      titleEn,
      subtitle,
      subtitleEn,
      slug,
      category,
      coverImage,
      summary,
      summaryEn,
      description,
      descriptionEn,
      organizerUserId,
      organizerName,
      partnerIds: partnerIds ?? [],
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      timezone: timezone ?? "UTC",
      locationType,
      locationJson,
      onlineUrl,
      status: status ?? "DRAFT",
      visibility: visibility ?? "PUBLIC",
      capacity,
      registrationOpenAt: registrationOpenAt ? new Date(registrationOpenAt) : undefined,
      registrationCloseAt: registrationCloseAt ? new Date(registrationCloseAt) : undefined,
      requiresApproval: requiresApproval ?? false,
      isFeatured: isFeatured ?? false,
      language: language ?? "zh",
      tags: tags ?? [],
      createdByUserId,
    },
  });

  // Auto-generate highlights for EVENT type (fire-and-forget)
  if (type === "EVENT") {
    void tryGenerateHighlightsAfterSave(activity.id);
  }

  return NextResponse.json({ activity }, { status: 201 });
}
