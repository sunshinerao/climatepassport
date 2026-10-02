import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { resolveInstitutionId } from "@/lib/server/person-institution-governance";
import { requireApiRole } from "@/lib/server/api-auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const apiAuth = await requireApiRole(["ADMIN"], req);
  if (apiAuth instanceof NextResponse) return apiAuth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  // CP-TODO-242: merged institution records stay resolvable through the merge chain.
  const institutionId = await resolveInstitutionId(prisma, params.id);
  if (!institutionId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
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
