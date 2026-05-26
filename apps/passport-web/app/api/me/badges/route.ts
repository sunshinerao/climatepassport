import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { ensureMvpBadgeDefinitions } from "@/lib/server/achievement-badge";
import { getPrismaClient } from "@/lib/server/prisma";

const querySchema = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
});

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/badges");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  await ensureMvpBadgeDefinitions();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query." }, { status: 400 });
  }

  const where = {
    userId: user.id,
    ...(parsed.data.status ? { status: parsed.data.status as never } : {}),
    ...(parsed.data.category
      ? { badgeDefinition: { category: parsed.data.category as never } }
      : {}),
  };

  const [total, awards] = await Promise.all([
    prisma.badgeAward.count({ where }),
    prisma.badgeAward.findMany({
      where,
      orderBy: [{ awardedAt: "desc" }],
      include: { badgeDefinition: true },
      skip: (parsed.data.page - 1) * parsed.data.pageSize,
      take: parsed.data.pageSize,
    }),
  ]);

  return NextResponse.json({
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
    awards,
  });
}
