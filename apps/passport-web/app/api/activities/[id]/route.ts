import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { tryGenerateHighlightsAfterSave } from "@/lib/server/activity-highlights";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    include: {
      detail: true,
      roles: true,
      tasks: true,
      rewardRules: true,
      certificateRules: true,
      _count: {
        select: {
          applications: true,
          participations: true,
          checkinRecords: true,
          submissions: true,
        },
      },
    },
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  // Auto-generate highlights for EVENT type (fire-and-forget)
  if (activity.type === "EVENT") {
    void tryGenerateHighlightsAfterSave(activity.id);
  }

  return NextResponse.json({ activity });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.activity.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  if (body.slug && body.slug !== existing.slug) {
    const slugTaken = await prisma.activity.findUnique({ where: { slug: body.slug } });
    if (slugTaken) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }
  }

  const {
    type, title, titleEn, subtitle, subtitleEn, slug, category, coverImage,
    summary, summaryEn, description, descriptionEn, organizerUserId, organizerName,
    partnerIds, startTime, endTime, timezone, locationType, locationJson, onlineUrl,
    status, visibility, capacity, registrationOpenAt, registrationCloseAt,
    requiresApproval, isFeatured, language, tags,
    // EVENT-specific fields
    eventLayer, hostType, trackId, isPinned, isPrivate, posterImage, mapUrl, highlights, highlightsEn,
  } = body;

  const activity = await (prisma.activity.update as any)({
    where: { id: params.id },
    data: {
      ...(type !== undefined && { type }),
      ...(title !== undefined && { title }),
      ...(titleEn !== undefined && { titleEn }),
      ...(subtitle !== undefined && { subtitle }),
      ...(subtitleEn !== undefined && { subtitleEn }),
      ...(slug !== undefined && { slug }),
      ...(category !== undefined && { category }),
      ...(coverImage !== undefined && { coverImage }),
      ...(summary !== undefined && { summary }),
      ...(summaryEn !== undefined && { summaryEn }),
      ...(description !== undefined && { description }),
      ...(descriptionEn !== undefined && { descriptionEn }),
      ...(organizerUserId !== undefined && { organizerUserId }),
      ...(organizerName !== undefined && { organizerName }),
      ...(partnerIds !== undefined && { partnerIds }),
      ...(startTime !== undefined && { startTime: startTime ? new Date(startTime) : null }),
      ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
      ...(timezone !== undefined && { timezone }),
      ...(locationType !== undefined && { locationType }),
      ...(locationJson !== undefined && { locationJson }),
      ...(onlineUrl !== undefined && { onlineUrl }),
      ...(status !== undefined && { status }),
      ...(visibility !== undefined && { visibility }),
      ...(capacity !== undefined && { capacity }),
      ...(registrationOpenAt !== undefined && { registrationOpenAt: registrationOpenAt ? new Date(registrationOpenAt) : null }),
      ...(registrationCloseAt !== undefined && { registrationCloseAt: registrationCloseAt ? new Date(registrationCloseAt) : null }),
      ...(requiresApproval !== undefined && { requiresApproval }),
      ...(isFeatured !== undefined && { isFeatured }),
      ...(language !== undefined && { language }),
      ...(tags !== undefined && { tags }),
      // EVENT-specific fields
      ...(eventLayer !== undefined && { eventLayer: eventLayer || null }),
      ...(hostType !== undefined && { hostType: hostType || null }),
      ...(trackId !== undefined && { trackId: trackId || null }),
      ...(isPinned !== undefined && { isPinned }),
      ...(isPrivate !== undefined && { isPrivate }),
      ...(posterImage !== undefined && { posterImage: posterImage || null }),
      ...(mapUrl !== undefined && { mapUrl: mapUrl || null }),
      ...(highlights !== undefined && { highlights }),
      ...(highlightsEn !== undefined && { highlightsEn }),
    },
  });

  return NextResponse.json({ activity });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const existing = await prisma.activity.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  await prisma.activity.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
