import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
try {
  const where = { OR: [{ deletedAt: { not: null, lt: before } }, { expiresAt: { lt: before } }] };
  const count = await prisma.activityAiContentDraft.count({ where });
  console.log(`${apply ? "Purging" : "Dry run:"} ${count} expired/deleted activity AI content drafts older than 30 days.`);
  if (apply && count) await prisma.activityAiContentDraft.deleteMany({ where });
} finally { await prisma.$disconnect(); }
