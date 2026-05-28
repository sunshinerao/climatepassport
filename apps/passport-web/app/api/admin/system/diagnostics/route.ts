import { NextResponse, type NextRequest } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  await requireRoleAccess("en", ["ADMIN"], "/en/admin/system");

  const prisma = getPrismaClient();

  let dbLatencyMs: number | null = null;
  let dbError: string | null = null;

  if (prisma) {
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbError = "DB query failed";
    }
  } else {
    dbError = "Database unavailable";
  }

  const appProcessingMs = Date.now() - startTime;

  // Client location from Vercel edge headers (only available on Vercel)
  const clientCountry = request.headers.get("x-vercel-ip-country") ?? null;
  const clientCity = request.headers.get("x-vercel-ip-city") ?? null;
  const clientRegion = request.headers.get("x-vercel-ip-country-region") ?? null;

  // App server region
  const serverRegion =
    process.env.VERCEL_REGION ??
    process.env.AWS_REGION ??
    "local";

  // Extract DB host from DATABASE_URL (hostname only, no credentials)
  let dbHost: string | null = null;
  const dbUrl = process.env.DATABASE_URL ?? "";
  const hostMatch = dbUrl.match(/@([^/?:]+)/);
  if (hostMatch?.[1]) {
    dbHost = hostMatch[1];
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    dbLatencyMs,
    dbError,
    appProcessingMs,
    serverRegion,
    dbHost,
    client: {
      country: clientCountry,
      city: clientCity,
      region: clientRegion,
    },
  });
}
