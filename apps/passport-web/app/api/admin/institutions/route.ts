import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const createInstitutionSchema = z.object({
  slug: z.string().trim().min(2).max(80),
  name: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().max(160).optional(),
  website: z.string().trim().url().optional(),
  orgType: z.string().trim().max(80).optional(),
  countryOrRegion: z.string().trim().max(80).optional(),
  countryOrRegionEn: z.string().trim().max(80).optional(),
});

export async function GET() {
  await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const institutions = await prisma.institution.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true, nameEn: true, website: true, orgType: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ institutions });
}

export async function POST(req: NextRequest) {
  await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const parsed = createInstitutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

  const exists = await prisma.institution.findUnique({ where: { slug } });
  if (exists) return NextResponse.json({ error: "Institution slug already exists" }, { status: 409 });

  const institution = await prisma.institution.create({
    data: {
      slug,
      name: data.name,
      nameEn: data.nameEn || null,
      website: data.website || null,
      orgType: data.orgType || null,
      countryOrRegion: data.countryOrRegion || null,
      countryOrRegionEn: data.countryOrRegionEn || null,
      isActive: true,
    },
    select: { id: true, slug: true, name: true, nameEn: true, website: true, orgType: true },
  });

  return NextResponse.json({ ok: true, institution });
}
