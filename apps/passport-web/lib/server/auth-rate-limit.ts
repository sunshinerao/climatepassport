import { createHash } from "crypto";
import { getPrismaClient } from "@/lib/server/prisma";

/** Persistent per-address quota, shared across workers. IP heuristics are supplementary only. */
export async function checkAuthRateLimit(
  email: string,
  scope: string,
  options: { limit: number; windowMs: number },
) {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || !Number.isSafeInteger(options.windowMs) || options.windowMs < 1) {
    throw new Error("INVALID_AUTH_RATE_LIMIT");
  }
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("AUTH_RATE_LIMIT_UNAVAILABLE");
  const start = Math.floor(Date.now() / options.windowMs) * options.windowMs;
  const key = createHash("sha256").update(JSON.stringify([scope, email.trim().toLowerCase(), start])).digest("hex");
  // A single atomic database increment, never a process-local read/modify/write.
  // Some Prisma versions emulate an initial upsert; retry its unique-key collision.
  const increment = () => prisma.authRequestLimit.upsert({
    where: { key },
    create: { key, count: 1, windowStart: new Date(start) },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  let bucket;
  try { bucket = await increment(); }
  catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw new Error("AUTH_RATE_LIMIT_UNAVAILABLE");
    try { bucket = await increment(); } catch { throw new Error("AUTH_RATE_LIMIT_UNAVAILABLE"); }
  }
  return { allowed: bucket.count <= options.limit, remaining: Math.max(0, options.limit - bucket.count), resetAt: start + options.windowMs };
}
