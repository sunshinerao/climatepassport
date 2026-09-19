import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { speakerLinkSchema } from "@/lib/server/people-master-data";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRoleAccess("en", ["ADMIN"], "/en/admin/speakers");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const speaker = await prisma.speaker.findUnique({
    where: { id: params.id },
    select: { id: true, personId: true },
  });
  if (!speaker) return NextResponse.json({ error: "Speaker not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = speakerLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { personId } = parsed.data;

  if (speaker.personId && speaker.personId !== personId) {
    return NextResponse.json(
      { error: "Speaker is already linked to a different person. Unlink first." },
      { status: 409 },
    );
  }

  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  await prisma.speaker.update({
    where: { id: params.id },
    data: { personId },
  });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "SPEAKER_LINK_PERSON",
    subjectType: "Speaker",
    subjectId: params.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { personId },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, speakerId: params.id, personId });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRoleAccess("en", ["ADMIN"], "/en/admin/speakers");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const speaker = await prisma.speaker.findUnique({
    where: { id: params.id },
    select: { id: true, personId: true },
  });
  if (!speaker) return NextResponse.json({ error: "Speaker not found" }, { status: 404 });
  if (!speaker.personId) return NextResponse.json({ error: "Speaker is not linked to a person" }, { status: 409 });

  const previousPersonId = speaker.personId;

  await prisma.speaker.update({
    where: { id: params.id },
    data: { personId: null },
  });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "SPEAKER_UNLINK_PERSON",
    subjectType: "Speaker",
    subjectId: params.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { previousPersonId },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, speakerId: params.id, previousPersonId });
}
