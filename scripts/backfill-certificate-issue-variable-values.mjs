#!/usr/bin/env node

import process from "node:process";

const targetDatabaseUrl = process.env.CLIMATE_PASSPORT_DATABASE_URL ?? process.env.DATABASE_URL;
if (targetDatabaseUrl) {
  process.env.DATABASE_URL = targetDatabaseUrl;
}

const { PrismaClient, Prisma } = await import("@prisma/client");

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const baseUrl = (process.env.CERTIFICATE_VERIFY_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function pickText(...values) {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return "";
}

function buildVariableValues(issue) {
  const certificateNumber = issue.verificationCode ?? issue.id;
  const issueDate = formatDate(issue.issuedAt ?? issue.createdAt);
  const holderName = pickText(issue.user?.name);
  const certificateName = pickText(issue.definition?.nameEn, issue.definition?.name);
  const categoryName = pickText(issue.definition?.category?.nameEn, issue.definition?.category?.name);
  const issuerName = pickText(issue.definition?.template?.renderConfigJson?.issuerName, "Climate Passport");

  return {
    holderName,
    holderNameEn: holderName,
    certificateName,
    certificateNameEn: certificateName,
    categoryName,
    categoryNameEn: categoryName,
    workName: "",
    workNameEn: "",
    eventName: "",
    eventNameEn: "",
    projectName: "",
    projectNameEn: "",
    programName: "",
    programNameEn: "",
    courseName: "",
    courseNameEn: "",
    roleName: "",
    roleNameEn: "",
    organizationName: issuerName,
    organizationNameEn: issuerName,
    institutionName: issuerName,
    institutionNameEn: issuerName,
    achievementName: "",
    achievementNameEn: "",
    milestoneName: "",
    milestoneNameEn: "",
    sessionName: "",
    sessionNameEn: "",
    topicName: "",
    topicNameEn: "",
    trackName: "",
    trackNameEn: "",
    speakerName: "",
    speakerNameEn: "",
    mentorName: "",
    mentorNameEn: "",
    cohortName: "",
    cohortNameEn: "",
    locationName: "",
    locationNameEn: "",
    completionDate: issueDate,
    issueDate,
    certificateNumber,
    issuerName,
    signer: pickText(issue.approver?.name, issuerName),
    learningHours: "",
    capabilityTags: [],
    verificationUrl: `${baseUrl}/verify/certificate/${encodeURIComponent(certificateNumber)}`,
  };
}

async function main() {
  const issues = await prisma.certificateIssue.findMany({
    where: {
      OR: [
        { variableValuesJson: { equals: Prisma.DbNull } },
        { variableValuesJson: { equals: Prisma.JsonNull } },
      ],
      status: "ISSUED",
    },
    include: {
      user: { select: { name: true } },
      approver: { select: { name: true } },
      definition: {
        include: {
          category: { select: { name: true, nameEn: true } },
          template: { select: { renderConfigJson: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (issues.length === 0) {
    console.log("No issued certificate records need variable backfill.");
    return;
  }

  console.log(`Found ${issues.length} issued records without variableValuesJson.`);

  if (dryRun) {
    console.log("Dry run mode: no data written.");
    return;
  }

  let updated = 0;
  for (const issue of issues) {
    const variableValuesJson = buildVariableValues(issue);
    await prisma.certificateIssue.update({
      where: { id: issue.id },
      data: { variableValuesJson },
    });
    updated += 1;
  }

  console.log(`Backfill completed. Updated ${updated} records.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
