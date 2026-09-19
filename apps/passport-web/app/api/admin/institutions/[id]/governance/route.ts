import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { institutionGovernanceUpdateSchema, serializeInstitution } from "@/lib/server/people-master-data";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRoleAccess("en", ["ADMIN"], "/en/admin/institutions");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.institution.findUnique({
    where: { id: params.id },
    select: { id: true, parentInstitutionId: true },
  });
  if (!existing) return NextResponse.json({ error: "Institution not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = institutionGovernanceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.parentInstitutionId && data.parentInstitutionId === params.id) {
    return NextResponse.json({ error: "Institution cannot be its own parent" }, { status: 400 });
  }
  if (data.parentInstitutionId) {
    const parent = await prisma.institution.findUnique({ where: { id: data.parentInstitutionId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "Parent institution not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    updateData[key] = value;
  }

  const institution = await prisma.institution.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true,
      slug: true,
      name: true,
      nameEn: true,
      shortName: true,
      shortNameEn: true,
      legalName: true,
      aliases: true,
      orgType: true,
      governanceType: true,
      countryOrRegion: true,
      countryOrRegionEn: true,
      website: true,
      verificationStatus: true,
      isActive: true,
    },
  });

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "INSTITUTION_GOVERNANCE_UPDATE",
    subjectType: "Institution",
    subjectId: institution.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { updatedFields: Object.keys(updateData) },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, institution: serializeInstitution(institution) });
}
