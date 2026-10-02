import type { Prisma } from "@prisma/client";

export const TICKET_STATUSES = ["PENDING", "REPLIED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const CONTACT_CATEGORIES = [
  "GENERAL",
  "ORGANIZATION",
  "PARTNERSHIP",
  "SPEAKER",
  "MEDIA",
  "SPONSOR",
  "VOLUNTEER",
  "OTHER",
] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export const TICKET_REPLY_MIN_LENGTH = 4;
export const TICKET_REPLY_MAX_LENGTH = 4000;
export const TICKET_SEARCH_MAX_LENGTH = 120;

type TicketRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  userId: string | null;
  category: ContactCategory;
  subject: string;
  message: string;
  status: TicketStatus;
  adminReply: string | null;
  adminNotes: string | null;
  repliedAt: Date | null;
  repliedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

export function isContactCategory(value: unknown): value is ContactCategory {
  return typeof value === "string" && (CONTACT_CATEGORIES as readonly string[]).includes(value);
}

export function buildTicketWhere(input: {
  status?: TicketStatus;
  category?: ContactCategory;
  search?: string;
}): Prisma.ContactMessageWhereInput {
  const where: Prisma.ContactMessageWhereInput = {};

  if (input.status) {
    where.status = input.status;
  }

  if (input.category) {
    where.category = input.category;
  }

  const search = input.search?.trim();

  if (search) {
    // An empty OR array matches nothing in Prisma, so the clause stays attached to a term.
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { message: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

export function serializeSupportTicket(ticket: TicketRow) {
  return {
    id: ticket.id,
    name: ticket.name,
    email: ticket.email,
    phone: ticket.phone,
    organization: ticket.organization,
    userId: ticket.userId,
    category: ticket.category,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status,
    adminReply: ticket.adminReply,
    adminNotes: ticket.adminNotes,
    repliedAt: ticket.repliedAt ? ticket.repliedAt.toISOString() : null,
    repliedBy: ticket.repliedBy,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export type TicketUpdateRequest = {
  currentStatus: TicketStatus;
  existingReply: string | null;
  status?: unknown;
  adminReply?: unknown;
  adminNotes?: unknown;
  actorUserId: string;
};

export type TicketUpdateData = {
  status?: TicketStatus;
  adminReply?: string;
  adminNotes?: string;
  repliedAt?: Date;
  repliedBy?: string;
};

export type TicketUpdateResult =
  | { ok: true; data: TicketUpdateData; from: TicketStatus; to: TicketStatus }
  | { ok: false; error: string; status: number };

export function resolveTicketUpdate(input: TicketUpdateRequest, now: Date): TicketUpdateResult {
  const from = input.currentStatus;

  if (from === "CLOSED") {
    return { ok: false, error: "Closed tickets are read-only.", status: 409 };
  }

  if (input.adminReply !== undefined) {
    if (typeof input.adminReply !== "string" || input.adminReply.trim().length < TICKET_REPLY_MIN_LENGTH) {
      return { ok: false, error: `Reply must be at least ${TICKET_REPLY_MIN_LENGTH} characters.`, status: 400 };
    }

    if (input.adminReply.trim().length > TICKET_REPLY_MAX_LENGTH) {
      return { ok: false, error: `Reply must stay under ${TICKET_REPLY_MAX_LENGTH} characters.`, status: 400 };
    }
  }

  if (input.adminNotes !== undefined) {
    if (typeof input.adminNotes !== "string" || input.adminNotes.trim().length > TICKET_REPLY_MAX_LENGTH) {
      return { ok: false, error: `Internal notes must stay under ${TICKET_REPLY_MAX_LENGTH} characters.`, status: 400 };
    }
  }

  if (input.status !== undefined && !isTicketStatus(input.status)) {
    return { ok: false, error: "Invalid status.", status: 400 };
  }

  if (input.status === "PENDING") {
    return { ok: false, error: "Tickets start pending and are never reopened as pending.", status: 409 };
  }

  const to = (input.status as TicketStatus | undefined) ?? from;

  const rawReply = input.adminReply === undefined ? input.existingReply : input.adminReply;
  const reply = rawReply?.trim() || undefined;

  if (to === "REPLIED" && !reply) {
    return { ok: false, error: "A reply is required before marking a ticket replied.", status: 400 };
  }

  const data: TicketUpdateData = {};

  if (to !== from) {
    data.status = to;
  }

  if (input.adminReply !== undefined) {
    data.adminReply = reply;
    data.repliedAt = now;
    data.repliedBy = input.actorUserId;
  }

  if (input.adminNotes !== undefined) {
    data.adminNotes = input.adminNotes.trim();
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Nothing to update.", status: 400 };
  }

  return { ok: true, data, from, to };
}
