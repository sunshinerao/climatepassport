import { PrismaClient } from "@prisma/client";
import { purgeExpiredAppOutcomes } from "../apps/passport-web/lib/server/app-outcomes";
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Explicit authorized DATABASE_URL required.");
  if (process.argv[2] !== "--apply") throw new Error("Usage: node --import=tsx scripts/purge-app-outcomes.ts --apply (operator-approved database only)");
  const prisma = new PrismaClient();
  try { console.log(JSON.stringify({ purgedBindings: await purgeExpiredAppOutcomes(prisma) })); }
  finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error("Outcome retention maintenance failed."); process.exitCode = 1; });
