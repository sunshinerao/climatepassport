import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { writeCoreAuditLog } from "@/lib/server/audit";
import { AI_DRAFT_LOCALES, validateDraftOutput } from "@/lib/server/activity-ai-content";

async function admin() { const user = await getCurrentUser(); return user?.role === "ADMIN" ? user : null; }
const editable = new Set(["GENERATED", "EDITED"]);
export async function PATCH(req: NextRequest, { params }: { params: { id: string; draftId: string } }) {
  const user = await admin(); if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  let body: { action?: string; outputJson?: unknown }; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const draft = await prisma.activityAiContentDraft.findFirst({ where: { id: params.draftId, activityId: params.id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  let data: any; let action: string;
  if (body.action === "edit") { if (!editable.has(draft.status)) return NextResponse.json({ error: "Draft is not editable" }, { status: 409 }); try { data = { status: "EDITED", outputJson: validateDraftOutput(draft.kind, body.outputJson), editedAt: new Date(), failureCode: null }; } catch { return NextResponse.json({ error: "Invalid output shape" }, { status: 400 }); } action = "EDITED"; }
  else if (body.action === "approve") { if (!editable.has(draft.status)) return NextResponse.json({ error: "Draft is not approvable" }, { status: 409 }); data = { status: "APPROVED", approvedAt: new Date() }; action = "APPROVED"; }
  else if (body.action === "reject") { if (["PUBLISHED", "DELETED", "REJECTED"].includes(draft.status)) return NextResponse.json({ error: "Draft cannot be rejected" }, { status: 409 }); data = { status: "REJECTED", rejectedAt: new Date() }; action = "REJECTED"; }
  else if (body.action === "delete") { if (draft.status === "PUBLISHED") return NextResponse.json({ error: "Published draft cannot be deleted" }, { status: 409 }); data = { status: "DELETED", deletedAt: new Date(), outputJson: null }; action = "DELETED"; }
  else if (body.action === "publish") {
    if (draft.status !== "APPROVED") return NextResponse.json({ error: "Only approved drafts can be published" }, { status: 409 });
    const output = draft.outputJson as any;
    const activityData = draft.kind === "HIGHLIGHTS" ? (draft.locale === "zh" ? { highlights: output.items } : { highlightsEn: output.items }) : draft.kind === "SUMMARY" ? (draft.locale === "zh" ? { summary: output.text } : { summaryEn: output.text }) : (draft.locale === "zh" ? { description: output.text } : { descriptionEn: output.text });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.activity.update({ where: { id: params.id }, data: activityData });
      return tx.activityAiContentDraft.update({ where: { id: draft.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    });
    await writeCoreAuditLog({ actorUserId: user.id, action: "ACTIVITY_AI_DRAFT_PUBLISHED", subjectType: "ActivityAiContentDraft", subjectId: draft.id, result: "PUBLISHED", metadataJson: { kind: draft.kind, locale: draft.locale } });
    return NextResponse.json({ draft: updated });
  } else return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const updated = await prisma.activityAiContentDraft.update({ where: { id: draft.id }, data });
  await writeCoreAuditLog({ actorUserId: user.id, action: `ACTIVITY_AI_DRAFT_${action}`, subjectType: "ActivityAiContentDraft", subjectId: draft.id, result: action, metadataJson: { kind: draft.kind, locale: draft.locale } });
  return NextResponse.json({ draft: updated });
}
