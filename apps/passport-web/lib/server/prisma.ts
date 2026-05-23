import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

declare global {
  var __climatePassportPrisma__: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function stripWrappedQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseDotEnvValue(fileContent: string, key: string) {
  const line = fileContent
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  if (!line) {
    return null;
  }

  const raw = line.slice(line.indexOf("=") + 1).trim();
  if (!raw) {
    return null;
  }

  return stripWrappedQuotes(raw);
}

function ensureDatabaseEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];

  for (const envPath of candidatePaths) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const content = fs.readFileSync(envPath, "utf8");
    const databaseUrl = parseDotEnvValue(content, "DATABASE_URL")
      ?? parseDotEnvValue(content, "CLIMATE_PASSPORT_DATABASE_URL");
    const directUrl = parseDotEnvValue(content, "DIRECT_URL") ?? databaseUrl;

    if (databaseUrl) {
      process.env.DATABASE_URL = databaseUrl;
      if (directUrl) {
        process.env.DIRECT_URL = directUrl;
      }
      return;
    }
  }

  if (process.env.CLIMATE_PASSPORT_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.CLIMATE_PASSPORT_DATABASE_URL;
    process.env.DIRECT_URL = process.env.DIRECT_URL ?? process.env.CLIMATE_PASSPORT_DATABASE_URL;
  }
}

export function getPrismaClient() {
  ensureDatabaseEnv();

  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!globalThis.__climatePassportPrisma__) {
    globalThis.__climatePassportPrisma__ = createPrismaClient();
  }

  return globalThis.__climatePassportPrisma__;
}