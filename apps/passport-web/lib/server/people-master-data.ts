import type { PersonVerificationStatus, PersonAffiliationStatus, PersonRoleType, InstitutionVerificationStatus } from "@prisma/client";
import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const personListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  verificationStatus: z.enum(["DRAFT", "PENDING", "VERIFIED", "REJECTED"]).optional(),
});

export const personCreateSchema = z.object({
  slug: z.string().trim().min(2).max(80).optional(),
  displayName: z.string().trim().min(1).max(120),
  displayNameEn: z.string().trim().max(160).optional(),
  salutation: z.string().trim().max(40).optional(),
  title: z.string().trim().max(120).optional(),
  titleEn: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(4000).optional(),
  bioEn: z.string().trim().max(4000).optional(),
  countryOrRegion: z.string().trim().max(80).optional(),
  countryOrRegionEn: z.string().trim().max(80).optional(),
  avatar: z.string().trim().url().max(500).optional(),
  website: z.string().trim().url().max(500).optional(),
  linkedin: z.string().trim().max(200).optional(),
  twitter: z.string().trim().max(200).optional(),
  orcid: z.string().trim().max(80).optional(),
  isPublic: z.boolean().optional(),
  verificationStatus: z.enum(["DRAFT", "PENDING", "VERIFIED", "REJECTED"]).optional(),
  verificationMetadata: z.record(z.string(), z.unknown()).optional(),
  userId: z.string().trim().uuid().optional(),
});

export const personUpdateSchema = personCreateSchema.partial();

export const affiliationCreateSchema = z.object({
  institutionId: z.string().trim().uuid().optional(),
  organizationName: z.string().trim().max(160).optional(),
  organizationNameEn: z.string().trim().max(160).optional(),
  department: z.string().trim().max(120).optional(),
  title: z.string().trim().max(120).optional(),
  titleEn: z.string().trim().max(160).optional(),
  startYear: z.number().int().min(1800).max(2100).optional(),
  endYear: z.number().int().min(1800).max(2100).optional(),
  isCurrent: z.boolean().optional(),
  status: z.enum(["ACTIVE", "ENDED", "PENDING"]).optional(),
  order: z.number().int().min(0).default(0),
});

export const roleProfileCreateSchema = z.object({
  roleType: z.enum([
    "SPEAKER",
    "MODERATOR",
    "PANELIST",
    "MENTOR",
    "ORGANIZER",
    "PARTNER",
    "MEDIA",
    "VOLUNTEER",
    "STAFF",
    "OTHER",
  ]),
  roleTitle: z.string().trim().max(160).optional(),
  roleTitleEn: z.string().trim().max(160).optional(),
  scopeInstitutionId: z.string().trim().uuid().optional(),
  isPrimary: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  startYear: z.number().int().min(1800).max(2100).optional(),
  endYear: z.number().int().min(1800).max(2100).optional(),
  order: z.number().int().min(0).default(0),
});

export const institutionListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export const institutionCreateSchema = z.object({
  slug: z.string().trim().min(2).max(80),
  name: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().max(160).optional(),
  shortName: z.string().trim().max(80).optional(),
  shortNameEn: z.string().trim().max(80).optional(),
  website: z.string().trim().url().optional(),
  orgType: z.string().trim().max(80).optional(),
  countryOrRegion: z.string().trim().max(80).optional(),
  countryOrRegionEn: z.string().trim().max(80).optional(),
  legalName: z.string().trim().max(160).optional(),
  aliases: z.array(z.string().trim().max(120)).max(20).default([]),
  governanceType: z.string().trim().max(80).optional(),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED"]).optional(),
  publicContactEmail: z.string().trim().email().max(120).optional(),
  publicContactPhone: z.string().trim().max(40).optional(),
  headquartersAddress: z.string().trim().max(240).optional(),
  foundingYear: z.number().int().min(1000).max(2100).optional(),
});

export const institutionGovernanceUpdateSchema = z.object({
  legalName: z.string().trim().max(160).optional(),
  aliases: z.array(z.string().trim().max(120)).max(20).optional(),
  parentInstitutionId: z.string().trim().uuid().optional().nullable(),
  governanceType: z.string().trim().max(80).optional(),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED"]).optional(),
  publicContactEmail: z.string().trim().email().max(120).optional().nullable(),
  publicContactPhone: z.string().trim().max(40).optional().nullable(),
  headquartersAddress: z.string().trim().max(240).optional().nullable(),
  foundingYear: z.number().int().min(1000).max(2100).optional().nullable(),
});

export const speakerListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  unlinkedOnly: z.enum(["true", "false"]).optional(),
});

export const speakerLinkSchema = z.object({
  personId: z.string().trim().uuid(),
});

export type PersonListQuery = z.infer<typeof personListQuerySchema>;
export type InstitutionListQuery = z.infer<typeof institutionListQuerySchema>;
export type SpeakerListQuery = z.infer<typeof speakerListQuerySchema>;

export function buildPersonWhere(query: PersonListQuery) {
  const where: {
    verificationStatus?: PersonVerificationStatus;
    OR?: Array<
      | { displayName: { contains: string; mode: "insensitive" } }
      | { displayNameEn: { contains: string; mode: "insensitive" } }
      | { slug: { contains: string; mode: "insensitive" } }
    >;
  } = {};

  if (query.verificationStatus) {
    where.verificationStatus = query.verificationStatus;
  }
  if (query.search) {
    where.OR = [
      { displayName: { contains: query.search, mode: "insensitive" } },
      { displayNameEn: { contains: query.search, mode: "insensitive" } },
      { slug: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export function buildInstitutionWhere(query: InstitutionListQuery) {
  const where: {
    verificationStatus?: InstitutionVerificationStatus;
    isActive?: boolean;
    OR?: Array<
      | { name: { contains: string; mode: "insensitive" } }
      | { nameEn: { contains: string; mode: "insensitive" } }
      | { slug: { contains: string; mode: "insensitive" } }
      | { aliases: { has: string } }
    >;
  } = {};

  if (query.verificationStatus) {
    where.verificationStatus = query.verificationStatus;
  }
  if (query.isActive !== undefined) {
    where.isActive = query.isActive === "true";
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { nameEn: { contains: query.search, mode: "insensitive" } },
      { slug: { contains: query.search, mode: "insensitive" } },
      { aliases: { has: query.search } },
    ];
  }
  return where;
}

export function buildSpeakerWhere(query: SpeakerListQuery) {
  const where: {
    personId?: null;
    OR?: Array<
      | { name: { contains: string; mode: "insensitive" } }
      | { nameEn: { contains: string; mode: "insensitive" } }
      | { organization: { contains: string; mode: "insensitive" } }
    >;
  } = {};

  if (query.unlinkedOnly === "true") {
    where.personId = null;
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { nameEn: { contains: query.search, mode: "insensitive" } },
      { organization: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export function serializePerson(person: {
  id: string;
  slug: string | null;
  displayName: string;
  displayNameEn: string | null;
  title: string | null;
  titleEn: string | null;
  verificationStatus: PersonVerificationStatus;
  isPublic: boolean;
  userId: string | null;
  _count?: { affiliations: number; roleProfiles: number; speakers: number };
}) {
  return {
    id: person.id,
    slug: person.slug,
    displayName: person.displayName,
    displayNameEn: person.displayNameEn,
    title: person.title,
    titleEn: person.titleEn,
    verificationStatus: person.verificationStatus,
    isPublic: person.isPublic,
    userId: person.userId,
    affiliationCount: person._count?.affiliations ?? 0,
    roleProfileCount: person._count?.roleProfiles ?? 0,
    speakerCount: person._count?.speakers ?? 0,
  };
}

export function serializeInstitution(institution: {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  shortName: string | null;
  shortNameEn: string | null;
  legalName: string | null;
  aliases: string[];
  orgType: string | null;
  governanceType: string | null;
  countryOrRegion: string | null;
  countryOrRegionEn: string | null;
  website: string | null;
  verificationStatus: InstitutionVerificationStatus;
  isActive: boolean;
}) {
  return {
    id: institution.id,
    slug: institution.slug,
    name: institution.name,
    nameEn: institution.nameEn,
    shortName: institution.shortName,
    shortNameEn: institution.shortNameEn,
    legalName: institution.legalName,
    aliases: institution.aliases,
    orgType: institution.orgType,
    governanceType: institution.governanceType,
    countryOrRegion: institution.countryOrRegion,
    countryOrRegionEn: institution.countryOrRegionEn,
    website: institution.website,
    verificationStatus: institution.verificationStatus,
    isActive: institution.isActive,
  };
}

export function serializeSpeaker(speaker: {
  id: string;
  name: string;
  nameEn: string | null;
  title: string | null;
  organization: string;
  personId: string | null;
  person: { id: string; displayName: string } | null;
}) {
  return {
    id: speaker.id,
    name: speaker.name,
    nameEn: speaker.nameEn,
    title: speaker.title,
    organization: speaker.organization,
    personId: speaker.personId,
    person: speaker.person ? { id: speaker.person.id, displayName: speaker.person.displayName } : null,
  };
}

export function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
