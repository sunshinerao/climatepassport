#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isBcryptLike, isValidBcryptHash } from "./password-verifier.mjs";

export const BCRYPT_COST = 10;

/**
 * Minimal dotenv-compatible parser for standard KEY=value files.
 * Supports blank lines, full-line comments, and optional single/double quotes.
 * Does not expand variable references or inline comments.
 */
export function parseEnvContent(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function resolveRepoRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..");
}

/**
 * Load only env keys that are not already explicitly set in process.env.
 * Existing environment variables always take precedence and are never overwritten.
 */
export function loadMissingEnvFromFile(filePath, keys) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const parsed = parseEnvContent(fs.readFileSync(filePath, "utf8"));
  const loaded = {};
  for (const key of keys) {
    if (process.env[key] === undefined && parsed[key] !== undefined) {
      process.env[key] = parsed[key];
      loaded[key] = parsed[key];
    }
  }
  return loaded;
}

export function getTargetDatabaseUrl() {
  return process.env.CLIMATE_PASSPORT_DATABASE_URL ?? process.env.DATABASE_URL;
}

export function configureMigrationEnvironment() {
  const repoRoot = resolveRepoRoot();
  const envPath = path.join(repoRoot, ".env");
  loadMissingEnvFromFile(envPath, ["CLIMATE_PASSPORT_DATABASE_URL", "DATABASE_URL"]);
}

export function formatUserIdentifier(user) {
  const rawId = user.id ?? "";
  const digest = crypto.createHash("sha256").update(String(rawId)).digest("hex");
  return `userRef=${digest.slice(0, 12)}`;
}

export function classifyPassword(user) {
  if (isValidBcryptHash(user.password)) {
    return { status: "bcrypt" };
  }

  if (isBcryptLike(user.password)) {
    return { status: "invalid", user };
  }

  if (typeof user.password !== "string" || user.password.trim() === "") {
    return { status: "blank", user };
  }

  return { status: "legacy", user };
}

export async function hashLegacyPassword(plaintext, hashFn = hash) {
  return hashFn(plaintext, BCRYPT_COST);
}

export async function migrateLegacyPasswords(
  users,
  { apply = false, prisma: prismaClient, hashFn = hashLegacyPassword } = {},
) {
  const summary = {
    total: users.length,
    bcrypt: 0,
    legacy: 0,
    blank: 0,
    invalid: 0,
    migrated: 0,
    conflicts: 0,
    issues: [],
  };

  for (const user of users) {
    const classification = classifyPassword(user);

    if (classification.status === "bcrypt") {
      summary.bcrypt++;
      continue;
    }

    if (classification.status === "blank" || classification.status === "invalid") {
      summary[classification.status]++;
      summary.issues.push({
        id: user.id,
        identifier: formatUserIdentifier(user),
        reason: classification.status === "invalid" ? "invalid/malformed" : "blank",
      });
      continue;
    }

    summary.legacy++;

    if (!apply) {
      summary.issues.push({
        id: user.id,
        identifier: formatUserIdentifier(user),
        reason: "legacy",
      });
      continue;
    }

    const newHash = await hashFn(user.password);
    const result = await prismaClient.user.updateMany({
      where: {
        id: user.id,
        password: user.password,
      },
      data: {
        password: newHash,
      },
    });

    if (result.count === 0) {
      summary.conflicts++;
      summary.issues.push({
        id: user.id,
        identifier: formatUserIdentifier(user),
        reason: "conflict",
      });
    } else {
      summary.migrated++;
    }
  }

  return summary;
}

function printSummary(summary) {
  console.log("--- Legacy password migration summary ---");
  console.log(`Total users scanned: ${summary.total}`);
  console.log(`Already bcrypt:      ${summary.bcrypt}`);
  console.log(`Legacy plaintext:    ${summary.legacy}`);
  console.log(`Blank:               ${summary.blank}`);
  console.log(`Invalid/malformed:   ${summary.invalid}`);
  if (summary.apply) {
    console.log(`Migrated:            ${summary.migrated}`);
    console.log(`Conflicts/skipped:   ${summary.conflicts}`);
  }

  if (summary.issues.length > 0) {
    console.log("Issues (opaque identifiers only):");
    for (const issue of summary.issues) {
      console.log(`  - ${issue.reason}: ${issue.identifier}`);
    }
  }
}

export async function main() {
  configureMigrationEnvironment();
  const targetDatabaseUrl = getTargetDatabaseUrl();

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  if (!targetDatabaseUrl) {
    console.error("Missing required environment variable: CLIMATE_PASSPORT_DATABASE_URL or DATABASE_URL");
    process.exit(1);
  }

  process.env.DATABASE_URL = targetDatabaseUrl;

  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        password: true,
      },
    });

    const summary = {
      total: users.length,
      bcrypt: 0,
      legacy: 0,
      blank: 0,
      invalid: 0,
      migrated: 0,
      conflicts: 0,
      issues: [],
    };

    for (const user of users) {
      const classification = classifyPassword(user);

      if (classification.status === "bcrypt") {
        summary.bcrypt++;
      } else if (classification.status === "legacy") {
        summary.legacy++;
      } else {
        summary[classification.status]++;
        summary.issues.push({
          id: user.id,
          identifier: formatUserIdentifier(user),
          reason: classification.status === "invalid" ? "invalid/malformed" : "blank",
        });
      }
    }

    const hasDirty = summary.blank > 0 || summary.invalid > 0;
    if (hasDirty) {
      summary.apply = apply;
      printSummary(summary);
      console.error("Blank or invalid/malformed passwords detected. Remediate these users before running migration.");
      process.exit(1);
    }

    const result = await migrateLegacyPasswords(users, { apply, prisma });
    result.apply = apply;

    printSummary(result);

    const hasUnprocessed = result.conflicts > 0;
    const hasPending = !apply && result.legacy > 0;

    if (hasUnprocessed || hasPending) {
      console.error(
        apply
          ? "Migration completed with issues. Remediate conflict users before considering the migration complete."
          : "Dry-run found legacy passwords. Review the counts above, then run with --apply.",
      );
      process.exit(1);
    }

    console.log(apply ? "Migration applied successfully." : "Dry-run complete: all stored passwords are bcrypt.");
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .catch((error) => {
      console.error("Legacy password migration failed");
      console.error(error);
      process.exitCode = 1;
    });
}
