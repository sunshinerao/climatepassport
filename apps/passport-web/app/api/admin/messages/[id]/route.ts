import { NextRequest, NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getPrismaClient } from "@/lib/server/prisma";
import { resolveTicketUpdate, serializeSupportTicket } from "@/lib/server/support-tickets";
import { requireApiRole } from "@/lib/server/api-auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as
    | { status?: unknown; adminReply?: unknown; adminNotes?: unknown }
    | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const ticket = await prisma.contactMessage.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  const result = resolveTicketUpdate(
    {
      currentStatus: ticket.status,
      existingReply: ticket.adminReply,
      status: body.status,
      adminReply: body.adminReply,
      adminNotes: body.adminNotes,
      actorUserId: user.id,
    },
    new Date(),
  );

  if (!result.ok) {
    await writeCoreAuditLog({
      actorUserId: user.id,
      action: "CONTACT_MESSAGE_TRIAGED",
      subjectType: "ContactMessage",
      subjectId: ticket.id,
      result: "REJECTED",
      ...getRequestAuditContext(req),
      metadataJson: { reason: result.error },
    }).catch(() => undefined);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const updated = await prisma.contactMessage.update({ where: { id: ticket.id }, data: result.data });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "CONTACT_MESSAGE_TRIAGED",
    subjectType: "ContactMessage",
    subjectId: updated.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: {
      from: result.from,
      to: result.to,
      replyWritten: result.data.adminReply !== undefined,
      notesUpdated: result.data.adminNotes !== undefined,
    },
  }).catch(() => undefined);

  return NextResponse.json({ ticket: serializeSupportTicket(updated) });
}
