import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { listSourceOwnedFieldConflicts } from "@/lib/server/source-activity-mapping";
import { requireApiRole } from "@/lib/server/api-auth";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { assertActivityScopeAccess } from "@/lib/server/programme-scope";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (!(await canManageActivity(prisma, auth, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const scopeCheck = await assertActivityScopeAccess(prisma, auth, params.id, "read");
  if (!scopeCheck.ok) return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status });

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

  return NextResponse.json({ activity });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.activity.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  if (!(await canManageActivity(prisma, auth, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const scopeCheck = await assertActivityScopeAccess(prisma, auth, params.id, "write");
  if (!scopeCheck.ok) return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status });

  if (auth.role === "EVENT_MANAGER") {
    const managerEditableFields = new Set([
      "title", "titleEn", "subtitle", "subtitleEn", "category", "coverImage",
      "summary", "summaryEn", "description", "descriptionEn", "startTime", "endTime",
      "timezone", "locationType", "locationJson", "onlineUrl", "language", "tags",
      "posterImage", "mapUrl", "highlights", "highlightsEn",
    ]);
    const forbiddenFields = Object.keys(body ?? {}).filter((field) => !managerEditableFields.has(field));
    if (forbiddenFields.length > 0) {
      return NextResponse.json(
        { error: "Event managers may only edit assigned activity content.", code: "ACTIVITY_MANAGER_FIELD_DENIED", fields: forbiddenFields },
        { status: 403 },
      );
    }
  }

  if (body.slug && body.slug !== existing.slug) {
    const slugTaken = await prisma.activity.findUnique({ where: { slug: body.slug } });
    if (slugTaken) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }
  }

  // CP-TODO-245：已接入来源的活动，其来源权威字段不可由 CP 编辑覆盖（CP-FR-053）；
  // 未映射活动不受影响。
  const sourceConflicts = await listSourceOwnedFieldConflicts(prisma, params.id, Object.keys(body ?? {}));
  if (sourceConflicts.length > 0) {
    return NextResponse.json(
      { error: `Fields are owned by the source programme and cannot be edited in CP: ${sourceConflicts.join(", ")}.`, code: "ACTIVITY_SOURCE_FIELD_CONFLICT" },
      { status: 409 },
    );
  }

  const {
    type, title, titleEn, subtitle, subtitleEn, slug, category, coverImage,
    summary, summaryEn, description, descriptionEn, organizerUserId, organizerName,
    partnerIds, startTime, endTime, timezone, locationType, locationJson, onlineUrl,
    status, visibility, capacity, registrationOpenAt, registrationCloseAt,
    requiresApproval, isFeatured, language, tags,
    applicantListVisibleToApplicants, allowInterestWithoutApplication,
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
      ...(existing.type === "PROJECT" && applicantListVisibleToApplicants !== undefined && { applicantListVisibleToApplicants }),
      ...(existing.type === "PROJECT" && allowInterestWithoutApplication !== undefined && { allowInterestWithoutApplication }),
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
  const auth = await requireApiRole(["ADMIN"], req);
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
