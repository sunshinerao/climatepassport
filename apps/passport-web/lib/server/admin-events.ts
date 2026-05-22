import { randomBytes } from "crypto";
import { z } from "zod";
import { eventLayerOptions, hostTypeOptions } from "@/lib/event-options";

export { eventLayerOptions, hostTypeOptions };

const booleanField = z.preprocess((value) => value === true || value === "true", z.boolean());
const optionalText = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const adminEventSchema = z.object({
  title: z.string().trim().min(2).max(180),
  titleEn: optionalText,
  description: z.string().trim().min(10).max(5000),
  descriptionEn: optionalText,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  venue: z.string().trim().min(2).max(180),
  venueEn: optionalText,
  address: optionalText,
  addressEn: optionalText,
  city: optionalText,
  cityEn: optionalText,
  type: z.string().trim().min(2).max(80),
  eventLayer: z.enum(eventLayerOptions).default("COMPREHENSIVE"),
  hostType: z.enum(hostTypeOptions).default("OFFICIAL"),
  requireApproval: booleanField.default(false),
  isPublished: booleanField.default(true),
  isClosed: booleanField.default(false),
  managerUserId: z
    .string()
    .trim()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
});

export type AdminEventInput = z.infer<typeof adminEventSchema>;

function toDate(value: string, endOfDay = false) {
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+08:00`);
}

export function createEventSecret() {
  return randomBytes(18).toString("hex");
}

export function buildEventWriteData(input: AdminEventInput, managerUserId: string) {
  return {
    title: input.title,
    titleEn: input.titleEn,
    description: input.description,
    descriptionEn: input.descriptionEn,
    shortDesc: input.description.slice(0, 140),
    shortDescEn: input.descriptionEn?.slice(0, 140),
    startDate: toDate(input.startDate),
    endDate: toDate(input.endDate, true),
    startTime: input.startTime,
    endTime: input.endTime,
    venue: input.venue,
    venueEn: input.venueEn,
    address: input.address,
    addressEn: input.addressEn,
    city: input.city,
    cityEn: input.cityEn,
    type: input.type,
    eventLayer: input.eventLayer,
    hostType: input.hostType,
    requireApproval: input.requireApproval,
    isPublished: input.isPublished,
    isClosed: input.isClosed,
    managerUserId,
  };
}

function formatDateInput(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function serializeAdminEvent(event: {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  type: string;
  venue: string;
  venueEn: string | null;
  address: string | null;
  addressEn: string | null;
  city: string | null;
  cityEn: string | null;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  requireApproval: boolean;
  isPublished: boolean;
  isClosed: boolean;
  eventLayer: string | null;
  hostType: string | null;
  managerUserId: string | null;
  manager: { name: string | null } | null;
  _count?: { registrations: number };
}) {
  return {
    id: event.id,
    title: event.title,
    titleEn: event.titleEn,
    description: event.description,
    descriptionEn: event.descriptionEn,
    type: event.type,
    venue: event.venue,
    venueEn: event.venueEn,
    address: event.address,
    addressEn: event.addressEn,
    city: event.city,
    cityEn: event.cityEn,
    startDate: formatDateInput(event.startDate),
    endDate: formatDateInput(event.endDate),
    startTime: event.startTime,
    endTime: event.endTime,
    requireApproval: event.requireApproval,
    isPublished: event.isPublished,
    isClosed: event.isClosed,
    eventLayer: event.eventLayer,
    hostType: event.hostType,
    managerUserId: event.managerUserId,
    managerName: event.manager?.name ?? null,
    registrationCount: event._count?.registrations ?? 0,
  };
}
