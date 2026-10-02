import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getPrismaClient } from "@/lib/server/prisma";
import {
  buildTicketWhere,
  CONTACT_CATEGORIES,
  serializeSupportTicket,
  TICKET_SEARCH_MAX_LENGTH,
  TICKET_STATUSES,
  type TicketStatus,
} from "@/lib/server/support-tickets";
import { requireApiRole } from "@/lib/server/api-auth";

const listQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(CONTACT_CATEGORIES).optional(),
  search: z.string().trim().max(TICKET_SEARCH_MAX_LENGTH).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const { status, category, search, page, pageSize } = parsed.data;
  const where = buildTicketWhere({ status, category, search });

  const [tickets, total, grouped] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(
    TICKET_STATUSES.map((value) => [
      value,
      grouped.find((entry) => entry.status === value)?._count._all ?? 0,
    ]),
  ) as Record<TicketStatus, number>;

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "CONTACT_MESSAGE_LIST_VIEWED",
    subjectType: "ContactMessage",
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { page, pageSize, total, status: status ?? null, category: category ?? null },
  }).catch(() => undefined);

  return NextResponse.json({
    tickets: tickets.map(serializeSupportTicket),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    counts,
  });
}
