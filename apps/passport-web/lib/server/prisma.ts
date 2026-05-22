import { PrismaClient } from "@prisma/client";

declare global {
  var __climatePassportPrisma__: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export function getPrismaClient() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!globalThis.__climatePassportPrisma__) {
    globalThis.__climatePassportPrisma__ = createPrismaClient();
  }

  return globalThis.__climatePassportPrisma__;
}