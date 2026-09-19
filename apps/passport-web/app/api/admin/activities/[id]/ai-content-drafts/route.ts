import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { writeCoreAuditLog } from "@/lib/server/audit";
import { checkRateLimitAsync, getRateLimitHeaders, getRateLimitSubjectReference } from "@/lib/server/rate-limit";
import { AI_DRAFT_KINDS, AI_DRAFT_LOCALES, AiContentError, buildSafeActivityAiSource, generateActivityAiContent } from "@/lib/server/activity-ai-content";

async function admin() { const user = await getCurrentUser(); return user?.role === "ADMIN" ? user : null; }
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await admin(); if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const drafts = await prisma.activityAiContentDraft.findMany({ where: { activityId: params.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ drafts });
}
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await admin(); if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { kind?: string; locale?: string }; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!AI_DRAFT_KINDS.includes(body.kind as any) || !AI_DRAFT_LOCALES.includes(body.locale as any)) return NextResponse.json({ error: "Invalid kind or locale" }, { status: 400 });
  const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const limit = await checkRateLimitAsync(`ai-content:${getRateLimitSubjectReference(`${user.id}:${params.id}`)}`, { limit: 5, windowMs: 60 * 60 * 1000, sensitive: true });
  if (!limit.allowed) return NextResponse.json({ error: limit.unavailable ? "AI service unavailable" : "Too many requests" }, { status: limit.unavailable ? 503 : 429, headers: limit.unavailable ? {} : getRateLimitHeaders(limit) });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const daily = await prisma.activityAiContentDraft.count({ where: { activityId: params.id, actorUserId: user.id, requestedAt: { gte: since } } });
  if (daily >= 10) return NextResponse.json({ error: "Daily draft budget reached" }, { status: 429 });
  const activity = await prisma.activity.findUnique({ where: { id: params.id }, select: { title: true, titleEn: true, subtitle: true, subtitleEn: true, summary: true, summaryEn: true, description: true, descriptionEn: true } });
  if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  const kind = body.kind as (typeof AI_DRAFT_KINDS)[number];
  const locale = body.locale as (typeof AI_DRAFT_LOCALES)[number];
  const source = buildSafeActivityAiSource(activity, locale);
  const draft = await prisma.activityAiContentDraft.create({ data: { activityId: params.id, actorUserId: user.id, kind, locale, sourceHash: source.sourceHash, sourceFieldCount: source.sourceFieldCount, sourceCharacterCount: source.sourceCharacterCount, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  await writeCoreAuditLog({ actorUserId: user.id, action: "ACTIVITY_AI_DRAFT_REQUESTED", subjectType: "ActivityAiContentDraft", subjectId: draft.id, result: "REQUESTED", metadataJson: { kind: draft.kind, locale: draft.locale, sourceFieldCount: draft.sourceFieldCount, sourceCharacterCount: draft.sourceCharacterCount } });
  try {
    const generated = await generateActivityAiContent(draft.kind, locale, source.source);
    const updated = await prisma.activityAiContentDraft.update({ where: { id: draft.id }, data: { status: "GENERATED", outputJson: generated.outputJson, providerAlias: generated.providerAlias, modelAlias: generated.modelAlias, generatedAt: new Date() } });
    await writeCoreAuditLog({ actorUserId: user.id, action: "ACTIVITY_AI_DRAFT_GENERATED", subjectType: "ActivityAiContentDraft", subjectId: draft.id, result: "GENERATED", metadataJson: { kind: draft.kind, locale: draft.locale } });
    return NextResponse.json({ draft: updated }, { status: 201 });
  } catch (error) {
    const code = error instanceof AiContentError ? error.code : "PROVIDER_UNAVAILABLE";
    const updated = await prisma.activityAiContentDraft.update({ where: { id: draft.id }, data: { status: "FAILED", failureCode: code } });
    await writeCoreAuditLog({ actorUserId: user.id, action: "ACTIVITY_AI_DRAFT_FAILED", subjectType: "ActivityAiContentDraft", subjectId: draft.id, result: "FAILED", metadataJson: { kind: draft.kind, locale: draft.locale, failureCode: code } });
    return NextResponse.json({ draft: updated, error: code === "AI_ASSIST_UNAVAILABLE" ? "AI service unavailable" : "Draft generation failed" }, { status: error instanceof AiContentError && error.status === 503 ? 503 : 502 });
  }
}
