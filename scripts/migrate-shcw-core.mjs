#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const extractOnly = args.includes("--extract-only");
const outputDirArgIndex = args.findIndex((arg) => arg === "--output-dir");
const outputDir =
  outputDirArgIndex >= 0 && args[outputDirArgIndex + 1]
    ? args[outputDirArgIndex + 1]
    : "artifacts/shcw-core-extract";
const sourceDatabaseUrl = process.env.SHCW_DATABASE_URL;

const steps = [
  {
    key: "identity",
    title: "Identity and account baseline",
    sourceModels: ["User", "Account", "Session", "VerificationToken", "Organization"],
    targetModels: ["User", "Account", "Session", "VerificationToken", "Organization"],
  },
  {
    key: "events",
    title: "Event hub baseline",
    sourceModels: ["Track", "Event", "EventDateSlot", "Speaker", "SpeakerRole", "AgendaItem"],
    targetModels: ["Track", "Institution", "Event", "EventDateSlot", "Speaker", "SpeakerRole", "AgendaItem"],
  },
  {
    key: "participation",
    title: "Participation and verifier baseline",
    sourceModels: ["Registration", "EventVerifier", "CheckIn", "Wishlist", "PointTransaction"],
    targetModels: ["Registration", "EventVerifier", "CheckIn", "Wishlist", "PointTransaction"],
  },
  {
    key: "requests",
    title: "Request-based modules",
    sourceModels: ["InvitationRequest", "SpecialPass"],
    targetModels: ["InvitationRequest", "SpecialPass"],
  },
  {
    key: "certificates",
    title: "Certificate Hub seed and linkage",
    sourceModels: ["derived from passport logic, attendance rules, and milestone rules"],
    targetModels: [
      "AchievementDefinition",
      "UserAchievement",
      "PassportMilestone",
      "CertificateCategory",
      "CertificateTemplate",
      "CertificateDefinition",
      "CertificateIssue",
      "CertificateVerification",
    ],
  },
];

const extractionScopes = [
  "tracks",
  "users",
  "events",
  "institutions",
  "event-institutions",
  "speakers",
  "speaker-roles",
  "agenda-items",
  "registrations",
  "event-verifiers",
  "checkins",
  "point-transactions",
  "invitation-requests",
  "special-passes",
];

function toIsoString(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function parseJsonValue(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getOutputFilePath(scope) {
  return path.join(process.cwd(), outputDir, `${scope}.json`);
}

function buildManifest(counts) {
  return {
    extractedAt: new Date().toISOString(),
    source: "SHCW",
    scopes: extractionScopes,
    counts,
  };
}

async function extractUsers(client) {
  const result = await client.query(`
    SELECT
      id,
      email,
      password,
      name,
      salutation,
      avatar,
      phone,
      title,
      bio,
      country,
      role,
      status,
      "staffPermissions",
      "passCode",
      "climatePassportId",
      points,
      "emailVerified",
      "resetToken",
      "resetTokenExpiry",
      "createdAt",
      "updatedAt"
    FROM users
    ORDER BY "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    salutation: row.salutation,
    avatar: row.avatar,
    phone: row.phone,
    title: row.title,
    bio: row.bio,
    country: row.country,
    role: row.role,
    status: row.status,
    staffPermissions: parseJsonValue(row.staffPermissions),
    passCode: row.passCode,
    climatePassportId: row.climatePassportId,
    points: row.points,
    emailVerified: toIsoString(row.emailVerified),
    resetToken: row.resetToken,
    resetTokenExpiry: toIsoString(row.resetTokenExpiry),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function extractTracks(client) {
  const result = await client.query(`
    SELECT
      id,
      code,
      name,
      "nameEn",
      description,
      "descriptionEn",
      category,
      color,
      icon,
      partners,
      "partnersEn",
      "order",
      "createdAt",
      "updatedAt"
    FROM tracks
    ORDER BY "order" ASC, "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    nameEn: row.nameEn,
    description: row.description,
    descriptionEn: row.descriptionEn,
    category: row.category,
    color: row.color,
    icon: row.icon,
    partners: parseJsonValue(row.partners),
    partnersEn: parseJsonValue(row.partnersEn),
    order: row.order,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function extractEvents(client) {
  const [eventsResult, dateSlotsResult] = await Promise.all([
    client.query(`
      SELECT
        id,
        title,
        "titleEn",
        description,
        "descriptionEn",
        "shortDesc",
        "shortDescEn",
        highlights,
        "highlightsEn",
        "highlightsGeneratedAt",
        "startDate",
        "endDate",
        "startTime",
        "endTime",
        venue,
        "venueEn",
        address,
        "addressEn",
        city,
        "cityEn",
        image,
        partners,
        "partnersEn",
        type,
        "eventLayer",
        "hostType",
        "trackId",
        "managerUserId",
        "venueCheckinSecret",
        "invitationContentHtml_zh",
        "invitationContentHtml_en",
        "maxAttendees",
        "requireApproval",
        "isClosed",
        "isPublished",
        "isFeatured",
        "isPinned",
        "createdAt",
        "updatedAt"
      FROM events
      ORDER BY "startDate" ASC, "startTime" ASC
    `),
    client.query(`
      SELECT
        id,
        "eventId",
        "scheduleDate",
        "startTime",
        "endTime",
        "createdAt",
        "updatedAt"
      FROM event_date_slots
      ORDER BY "scheduleDate" ASC, "startTime" ASC
    `),
  ]);

  const dateSlotsByEventId = new Map();

  for (const row of dateSlotsResult.rows) {
    const items = dateSlotsByEventId.get(row.eventId) ?? [];
    items.push({
      id: row.id,
      eventId: row.eventId,
      scheduleDate: toIsoString(row.scheduleDate),
      startTime: row.startTime,
      endTime: row.endTime,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    });
    dateSlotsByEventId.set(row.eventId, items);
  }

  return eventsResult.rows.map((row) => ({
    id: row.id,
    title: row.title,
    titleEn: row.titleEn,
    description: row.description,
    descriptionEn: row.descriptionEn,
    shortDesc: row.shortDesc,
    shortDescEn: row.shortDescEn,
    highlights: parseJsonValue(row.highlights),
    highlightsEn: parseJsonValue(row.highlightsEn),
    highlightsGeneratedAt: toIsoString(row.highlightsGeneratedAt),
    startDate: toIsoString(row.startDate),
    endDate: toIsoString(row.endDate),
    startTime: row.startTime,
    endTime: row.endTime,
    venue: row.venue,
    venueEn: row.venueEn,
    address: row.address,
    addressEn: row.addressEn,
    city: row.city,
    cityEn: row.cityEn,
    image: row.image,
    partners: parseJsonValue(row.partners),
    partnersEn: parseJsonValue(row.partnersEn),
    type: row.type,
    eventLayer: row.eventLayer,
    hostType: row.hostType,
    trackId: row.trackId,
    managerUserId: row.managerUserId,
    venueCheckinSecret: row.venueCheckinSecret,
    invitationContentHtmlZh: row.invitationContentHtml_zh,
    invitationContentHtmlEn: row.invitationContentHtml_en,
    maxAttendees: row.maxAttendees,
    requireApproval: row.requireApproval,
    isClosed: row.isClosed,
    isPublished: row.isPublished,
    isFeatured: row.isFeatured,
    isPinned: row.isPinned,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    eventDateSlots: dateSlotsByEventId.get(row.id) ?? [],
  }));
}

async function extractInstitutions(client) {
  const result = await client.query(`
    SELECT
      id,
      slug,
      name,
      "nameEn",
      "shortName",
      "shortNameEn",
      logo,
      website,
      "orgType",
      "countryOrRegion",
      "countryOrRegionEn",
      description,
      "descriptionEn",
      "isActive",
      "order",
      "createdAt",
      "updatedAt"
    FROM institutions
    ORDER BY "order" ASC, "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.nameEn,
    shortName: row.shortName,
    shortNameEn: row.shortNameEn,
    logo: row.logo,
    website: row.website,
    orgType: row.orgType,
    countryOrRegion: row.countryOrRegion,
    countryOrRegionEn: row.countryOrRegionEn,
    description: row.description,
    descriptionEn: row.descriptionEn,
    isActive: row.isActive,
    order: row.order,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function extractEventInstitutions(client) {
  const result = await client.query(`
    SELECT
      "eventId",
      "institutionId",
      role,
      "order"
    FROM event_institutions
    ORDER BY "order" ASC, "eventId" ASC
  `);

  return result.rows.map((row) => ({
    eventId: row.eventId,
    institutionId: row.institutionId,
    role: row.role,
    order: row.order,
  }));
}

async function extractSpeakers(client) {
  const result = await client.query(`
    SELECT
      id,
      slug,
      salutation,
      name,
      "nameEn",
      avatar,
      title,
      "titleEn",
      organization,
      "organizationEn",
      "organizationLogo",
      bio,
      "bioEn",
      summary,
      "summaryEn",
      "countryOrRegion",
      "countryOrRegionEn",
      "relevanceToShcw",
      "relevanceToShcwEn",
      "expertiseTags",
      email,
      linkedin,
      twitter,
      website,
      "isKeynote",
      "isVisible",
      "agendaRoleDisplayMode",
      "institutionId",
      "order",
      "createdAt",
      "updatedAt"
    FROM speakers
    ORDER BY "order" ASC, "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    salutation: row.salutation,
    name: row.name,
    nameEn: row.nameEn,
    avatar: row.avatar,
    title: row.title,
    titleEn: row.titleEn,
    organization: row.organization,
    organizationEn: row.organizationEn,
    organizationLogo: row.organizationLogo,
    bio: row.bio,
    bioEn: row.bioEn,
    summary: row.summary,
    summaryEn: row.summaryEn,
    countryOrRegion: row.countryOrRegion,
    countryOrRegionEn: row.countryOrRegionEn,
    relevanceToShcw: row.relevanceToShcw,
    relevanceToShcwEn: row.relevanceToShcwEn,
    expertiseTags: parseJsonValue(row.expertiseTags),
    email: row.email,
    linkedin: row.linkedin,
    twitter: row.twitter,
    website: row.website,
    isKeynote: row.isKeynote,
    isVisible: row.isVisible,
    agendaRoleDisplayMode: row.agendaRoleDisplayMode,
    institutionId: row.institutionId,
    order: row.order,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function extractSpeakerRoles(client) {
  const result = await client.query(`
    SELECT
      id,
      "speakerId",
      title,
      "titleEn",
      organization,
      "organizationEn",
      "startYear",
      "endYear",
      "isCurrent",
      "order",
      "createdAt",
      "updatedAt"
    FROM speaker_roles
    ORDER BY "order" ASC, "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    speakerId: row.speakerId,
    title: row.title,
    titleEn: row.titleEn,
    organization: row.organization,
    organizationEn: row.organizationEn,
    startYear: row.startYear,
    endYear: row.endYear,
    isCurrent: row.isCurrent,
    order: row.order,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function extractAgendaItems(client) {
  const [agendaItemsResult, agendaSpeakerLinksResult] = await Promise.all([
    client.query(`
      SELECT
        id,
        "eventId",
        "agendaDate",
        "startTime",
        "endTime",
        title,
        "titleEn",
        description,
        "descriptionEn",
        type,
        venue,
        "speakerMeta",
        "moderatorId",
        "order",
        "createdAt",
        "updatedAt"
      FROM agenda_items
      ORDER BY "agendaDate" ASC, "startTime" ASC, "order" ASC
    `),
    client.query(`
      SELECT
        "A" AS "agendaItemId",
        "B" AS "speakerId"
      FROM "_AgendaItemToSpeaker"
      ORDER BY "A" ASC, "B" ASC
    `),
  ]);

  const speakerIdsByAgendaItemId = new Map();

  for (const row of agendaSpeakerLinksResult.rows) {
    const items = speakerIdsByAgendaItemId.get(row.agendaItemId) ?? [];
    items.push(row.speakerId);
    speakerIdsByAgendaItemId.set(row.agendaItemId, items);
  }

  return agendaItemsResult.rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    agendaDate: toIsoString(row.agendaDate),
    startTime: row.startTime,
    endTime: row.endTime,
    title: row.title,
    titleEn: row.titleEn,
    description: row.description,
    descriptionEn: row.descriptionEn,
    type: row.type,
    venue: row.venue,
    speakerMeta: parseJsonValue(row.speakerMeta),
    moderatorId: row.moderatorId,
    order: row.order,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    speakerIds: speakerIdsByAgendaItemId.get(row.id) ?? [],
  }));
}

async function extractRegistrations(client) {
  const result = await client.query(`
    SELECT
      id,
      "userId",
      "eventId",
      status,
      notes,
      "dietaryReq",
      "checkedInAt",
      "checkedInBy",
      "checkInMethod",
      "pointsEarned",
      "createdAt",
      "updatedAt"
    FROM registrations
    ORDER BY "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    status: row.status,
    notes: row.notes,
    dietaryReq: row.dietaryReq,
    checkedInAt: toIsoString(row.checkedInAt),
    checkedInBy: row.checkedInBy,
    checkInMethod: row.checkInMethod,
    pointsEarned: row.pointsEarned,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function extractEventVerifiers(client) {
  const result = await client.query(`
    SELECT
      id,
      "userId",
      "eventId",
      "createdAt"
    FROM event_verifiers
    ORDER BY "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    createdAt: toIsoString(row.createdAt),
  }));
}

async function extractCheckins(client) {
  const result = await client.query(`
    SELECT
      id,
      "userId",
      "eventId",
      "scannedBy",
      "scannedAt",
      method,
      "createdAt"
    FROM checkins
    ORDER BY "scannedAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    scannedBy: row.scannedBy,
    scannedAt: toIsoString(row.scannedAt),
    method: row.method,
    createdAt: toIsoString(row.createdAt),
  }));
}

async function extractPointTransactions(client) {
  const result = await client.query(`
    SELECT
      id,
      "userId",
      points,
      type,
      "eventId",
      "registrationId",
      description,
      "createdBy",
      "createdAt"
    FROM point_transactions
    ORDER BY "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    points: row.points,
    type: row.type,
    eventId: row.eventId,
    registrationId: row.registrationId,
    description: row.description,
    createdBy: row.createdBy,
    createdAt: toIsoString(row.createdAt),
  }));
}

async function extractInvitationRequests(client) {
  const result = await client.query(`
    SELECT
      id,
      "userId",
      salutation,
      "guestName",
      "guestTitle",
      "guestOrg",
      "guestEmail",
      language,
      "eventId",
      purpose,
      notes,
      "customMainContent",
      "aiEnhancedBodyZh",
      "aiEnhancedBodyEn",
      "signaturePresetId",
      "useStamp",
      status,
      "letterFileUrl",
      "rejectReason",
      "createdAt",
      "updatedAt"
    FROM invitation_requests
    ORDER BY "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    salutation: row.salutation,
    guestName: row.guestName,
    guestTitle: row.guestTitle,
    guestOrg: row.guestOrg,
    guestEmail: row.guestEmail,
    language: row.language,
    eventId: row.eventId,
    purpose: row.purpose,
    notes: row.notes,
    customMainContent: row.customMainContent,
    aiEnhancedBodyZh: row.aiEnhancedBodyZh,
    aiEnhancedBodyEn: row.aiEnhancedBodyEn,
    signaturePresetId: row.signaturePresetId,
    useStamp: row.useStamp,
    status: row.status,
    letterFileUrl: row.letterFileUrl,
    rejectReason: row.rejectReason,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function extractSpecialPasses(client) {
  const result = await client.query(`
    SELECT
      id,
      "userId",
      "entryType",
      status,
      country,
      name,
      "birthDate",
      gender,
      "docNumber",
      "docValidFrom",
      "docValidTo",
      "docPhoto",
      "docPhotoBack",
      photo,
      organization,
      "jobTitle",
      "docType",
      email,
      "phoneArea",
      phone,
      "contactMethod",
      "contactValue",
      "adminNotes",
      "reviewedBy",
      "reviewedAt",
      "createdAt",
      "updatedAt"
    FROM special_passes
    ORDER BY "createdAt" ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    entryType: row.entryType,
    status: row.status,
    country: row.country,
    name: row.name,
    birthDate: row.birthDate,
    gender: row.gender,
    docNumber: row.docNumber,
    docValidFrom: row.docValidFrom,
    docValidTo: row.docValidTo,
    docPhoto: row.docPhoto,
    docPhotoBack: row.docPhotoBack,
    photo: row.photo,
    organization: row.organization,
    jobTitle: row.jobTitle,
    docType: row.docType,
    email: row.email,
    phoneArea: row.phoneArea,
    phone: row.phone,
    contactMethod: row.contactMethod,
    contactValue: row.contactValue,
    adminNotes: row.adminNotes,
    reviewedBy: row.reviewedBy,
    reviewedAt: toIsoString(row.reviewedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

async function writeExtractionArtifacts(artifacts) {
  const resolvedOutputDir = path.join(process.cwd(), outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  await Promise.all(
    Object.entries(artifacts).map(async ([scope, payload]) => {
      await writeFile(getOutputFilePath(scope), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    }),
  );
}

async function runExtraction() {
  if (!sourceDatabaseUrl) {
    console.error("Missing required environment variable: SHCW_DATABASE_URL");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: sourceDatabaseUrl });

  try {
    const [tracks, users, events, institutions, eventInstitutions, speakers, speakerRoles, agendaItems, registrations, eventVerifiers, checkins, pointTransactions, invitationRequests, specialPasses] = await Promise.all([
      extractTracks(pool),
      extractUsers(pool),
      extractEvents(pool),
      extractInstitutions(pool),
      extractEventInstitutions(pool),
      extractSpeakers(pool),
      extractSpeakerRoles(pool),
      extractAgendaItems(pool),
      extractRegistrations(pool),
      extractEventVerifiers(pool),
      extractCheckins(pool),
      extractPointTransactions(pool),
      extractInvitationRequests(pool),
      extractSpecialPasses(pool),
    ]);

    const manifest = buildManifest({
      tracks: tracks.length,
      users: users.length,
      events: events.length,
      institutions: institutions.length,
      eventInstitutions: eventInstitutions.length,
      speakers: speakers.length,
      speakerRoles: speakerRoles.length,
      agendaItems: agendaItems.length,
      registrations: registrations.length,
      eventVerifiers: eventVerifiers.length,
      checkins: checkins.length,
      pointTransactions: pointTransactions.length,
      invitationRequests: invitationRequests.length,
      specialPasses: specialPasses.length,
    });

    await writeExtractionArtifacts({
      manifest,
      tracks,
      users,
      events,
      institutions,
      "event-institutions": eventInstitutions,
      speakers,
      "speaker-roles": speakerRoles,
      "agenda-items": agendaItems,
      registrations,
      "event-verifiers": eventVerifiers,
      checkins,
      "point-transactions": pointTransactions,
      "invitation-requests": invitationRequests,
      "special-passes": specialPasses,
    });

    printBlock("Extraction complete", [
      `output: ${path.join(outputDir, "manifest.json")}`,
      `tracks: ${tracks.length}`,
      `users: ${users.length}`,
      `events: ${events.length}`,
      `institutions: ${institutions.length}`,
      `event institutions: ${eventInstitutions.length}`,
      `speakers: ${speakers.length}`,
      `speaker roles: ${speakerRoles.length}`,
      `agenda items: ${agendaItems.length}`,
      `registrations: ${registrations.length}`,
      `event verifiers: ${eventVerifiers.length}`,
      `checkins: ${checkins.length}`,
      `point transactions: ${pointTransactions.length}`,
      `invitation requests: ${invitationRequests.length}`,
      `special passes: ${specialPasses.length}`,
    ]);
  } finally {
    await pool.end();
  }
}

function printBlock(title, lines) {
  console.log(`\n${title}`);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}

console.log("Climate Passport migration bootstrap");
console.log(`Mode: ${dryRun ? "dry-run" : extractOnly ? "extract-only" : "execute"}`);

if (!dryRun && !extractOnly) {
  const required = ["SHCW_DATABASE_URL", "CLIMATE_PASSPORT_DATABASE_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

steps.forEach((step, index) => {
  printBlock(`${index + 1}. ${step.title}`, [
    `source: ${step.sourceModels.join(", ")}`,
    `target: ${step.targetModels.join(", ")}`,
  ]);
});

if (dryRun) {
  printBlock("Next implementation hooks", [
    "normalize source records according to docs/SOURCE_TO_TARGET_DATA_MAPPING_20260520.md",
    "write target upsert batches in dependency order so legacy IDs and timestamps can be preserved",
    "append checkpoint logs for every module to support re-runs and auditability",
    `extract source baseline JSON with: npm run migrate:core:extract -- --output-dir ${outputDir}`,
  ]);

  process.exit(0);
}

if (extractOnly) {
  printBlock("Extraction scopes", extractionScopes.map((scope) => scope));
  await runExtraction();
  process.exit(0);
}

console.log("Execution mode is reserved for the next phase after source queries and target upserts are implemented.");