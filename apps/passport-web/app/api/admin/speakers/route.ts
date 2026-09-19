import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { buildSpeakerWhere, serializeSpeaker, speakerListQuerySchema } from "@/lib/server/people-master-data";

export async function GET(req: NextRequest) {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/speakers");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const parsed = speakerListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    unlinkedOnly: searchParams.get("unlinkedOnly") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const query = parsed.data;
  const where = buildSpeakerWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [speakers, total] = await Promise.all([
    prisma.speaker.findMany({
      where,
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      skip,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        nameEn: true,
        title: true,
        organization: true,
        personId: true,
        person: { select: { id: true, displayName: true } },
      },
    }),
    prisma.speaker.count({ where }),
  ]);

  return NextResponse.json({
    speakers: speakers.map(serializeSpeaker),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  });
}
