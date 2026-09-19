import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/institutions");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const institution = await prisma.institution.findUnique({
    where: { id: params.id },
    include: {
      parentInstitution: { select: { id: true, name: true, slug: true } },
      childInstitutions: { orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } },
      personAffiliations: {
        orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
        include: { person: { select: { id: true, displayName: true } } },
      },
      personRoleProfiles: {
        orderBy: { createdAt: "desc" },
        include: { person: { select: { id: true, displayName: true } } },
      },
      _count: { select: { speakers: true, personAffiliations: true, personRoleProfiles: true } },
    },
  });

  if (!institution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });

  return NextResponse.json({ institution });
}
