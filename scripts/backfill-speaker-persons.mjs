#!/usr/bin/env node
// Backfill deterministic Person + SPEAKER role profile for every Speaker without a personId.
// Default is --dry-run. Pass --apply to write. No fuzzy/email/name/User/Institution/Organization matching.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvKey(fileContent, key) {
  const line = fileContent.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}=`));
  if (!line) return null;
  const raw = line.slice(line.indexOf("=") + 1).trim();
  if (!raw) return null;
  return stripQuotes(raw);
}

function ensureDatabaseEnv() {
  if (process.env.DATABASE_URL) return;
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const envPath of candidatePaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, "utf8");
    const databaseUrl = parseEnvKey(content, "DATABASE_URL") ?? parseEnvKey(content, "CLIMATE_PASSPORT_DATABASE_URL");
    const directUrl = parseEnvKey(content, "DIRECT_URL") ?? databaseUrl;
    if (databaseUrl) {
      process.env.DATABASE_URL = databaseUrl;
      if (directUrl) process.env.DIRECT_URL = directUrl;
      return;
    }
  }
  if (process.env.CLIMATE_PASSPORT_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.CLIMATE_PASSPORT_DATABASE_URL;
    process.env.DIRECT_URL = process.env.DIRECT_URL ?? process.env.CLIMATE_PASSPORT_DATABASE_URL;
  }
}

ensureDatabaseEnv();

if (!process.env.DATABASE_URL) {
  console.error(JSON.stringify({ error: "DATABASE_URL is not set" }));
  process.exit(1);
}

const prisma = new PrismaClient({ log: ["warn", "error"] });

function summarizeId(id) {
  if (!id) return null;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

async function runDryRun(unlinked) {
  const report = {
    mode: "dry-run",
    unlinkedCount: unlinked.length,
    wouldCreatePeople: unlinked.length,
    wouldCreateRoleProfiles: unlinked.length,
    wouldLinkSpeakers: unlinked.length,
    sampleSpeakerIds: unlinked.slice(0, 5).map((s) => summarizeId(s.id)),
    writes: 0,
    note: "Pass --apply to execute. Zero database writes occurred.",
  };
  console.log(JSON.stringify(report, null, 2));
}

async function runApply(unlinked) {
  const maxRetries = 3;
  let attempt = 0;
  let created = 0;
  let linked = 0;
  const speakerIds = [];
  const personIds = [];

  while (attempt < maxRetries) {
    attempt += 1;
    created = 0;
    linked = 0;
    speakerIds.length = 0;
    personIds.length = 0;

    try {
      await prisma.$transaction(
        async (tx) => {
          for (const speaker of unlinked) {
            const person = await tx.person.create({
              data: {
                displayName: speaker.name,
                displayNameEn: speaker.nameEn,
                salutation: speaker.salutation,
                title: speaker.title,
                titleEn: speaker.titleEn,
                bio: speaker.bio,
                bioEn: speaker.bioEn,
                countryOrRegion: speaker.countryOrRegion,
                countryOrRegionEn: speaker.countryOrRegionEn,
                avatar: speaker.avatar,
                website: speaker.website,
                linkedin: speaker.linkedin,
                twitter: speaker.twitter,
                isPublic: speaker.isVisible,
                verificationStatus: "DRAFT",
              },
              select: { id: true },
            });

            await tx.personRoleProfile.create({
              data: {
                personId: person.id,
                roleType: "SPEAKER",
                roleTitle: speaker.title,
                roleTitleEn: speaker.titleEn,
                scopeInstitutionId: speaker.institutionId,
                isVisible: true,
                order: 0,
              },
            });

            await tx.speaker.update({
              where: { id: speaker.id },
              data: { personId: person.id },
            });

            created += 1;
            linked += 1;
            speakerIds.push(speaker.id);
            personIds.push(person.id);
          }
        },
        { maxWait: 10_000, timeout: 60_000 },
      );

      break;
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
      console.error(JSON.stringify({ attempt, error: error.message, retry: true }));
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  const report = {
    mode: "apply",
    processedCount: unlinked.length,
    createdPeople: created,
    linkedSpeakers: linked,
    speakerIds: speakerIds.map(summarizeId),
    personIds: personIds.map(summarizeId),
    retriesUsed: attempt > 1 ? attempt - 1 : 0,
  };
  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  const unlinked = await prisma.speaker.findMany({
    where: { personId: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      nameEn: true,
      salutation: true,
      title: true,
      titleEn: true,
      bio: true,
      bioEn: true,
      countryOrRegion: true,
      countryOrRegionEn: true,
      avatar: true,
      website: true,
      linkedin: true,
      twitter: true,
      isVisible: true,
      institutionId: true,
    },
  });

  if (DRY_RUN) {
    await runDryRun(unlinked);
  } else {
    await runApply(unlinked);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(JSON.stringify({ error: error.message, stack: error.stack }));
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
