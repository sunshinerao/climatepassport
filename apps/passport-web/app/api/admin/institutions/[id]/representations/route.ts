import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession, normalizeUserEmail } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import {
  grantInstitutionRepresentation,
  resolveInstitutionId,
  resolveInstitutionRepresentation,
} from "@/lib/server/person-institution-governance";

const grantSchema = z.object({
  userId: z.string().uuid().optional(),
  userEmail: z.string().trim().email().optional(),
  programmeId: z.string().uuid().optional(),
  programmeKey: z.string().trim().min(2).max(80).optional(),
  editionId: z.string().uuid().optional(),
  editionKey: z.string().trim().min(1).max(80).optional(),
  actionScope: z.array(z.enum(["READ", "WRITE", "MANAGE"])).min(1),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  basis: z.record(z.string(), z.unknown()).optional(),
});

/**
 * CP-TODO-242：授予机构代表权。调用者必须是 ADMIN，或本人持有该机构
 * MANAGE 范围的有效代表权（代表权可委托，任职关系不构成授权依据）。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const institutionId = await resolveInstitutionId(prisma, params.id);
  if (!institutionId) return NextResponse.json({ error: "Institution not found." }, { status: 404 });

  if (session.user.role !== "ADMIN") {
    const delegation = await resolveInstitutionRepresentation(prisma, {
      userId: session.user.id,
      institutionId,
      action: "manage",
    });
    if (!delegation.granted) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = grantSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  const value = parsed.data;
  if (!value.userId && !value.userEmail) return NextResponse.json({ error: "userId or userEmail is required." }, { status: 400 });
  if (!value.programmeId && !value.programmeKey) return NextResponse.json({ error: "programmeId or programmeKey is required." }, { status: 400 });

  const targetUser = value.userId
    ? await prisma.user.findUnique({ where: { id: value.userId }, select: { id: true } })
    : await prisma.user.findUnique({ where: { email: normalizeUserEmail(value.userEmail!) }, select: { id: true } });
  if (!targetUser) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const programme = value.programmeId
    ? await prisma.programme.findFirst({ where: { id: value.programmeId, isActive: true }, select: { id: true } })
    : await prisma.programme.findFirst({ where: { key: value.programmeKey!, isActive: true }, select: { id: true } });
  if (!programme) return NextResponse.json({ error: "Programme not found or inactive." }, { status: 404 });

  let editionId: string | null = null;
  if (value.editionId || value.editionKey) {
    const edition = value.editionId
      ? await prisma.edition.findFirst({ where: { id: value.editionId, programmeId: programme.id }, select: { id: true } })
      : await prisma.edition.findFirst({ where: { programmeId: programme.id, key: value.editionKey! }, select: { id: true } });
    if (!edition) return NextResponse.json({ error: "Edition not found for the programme." }, { status: 404 });
    editionId = edition.id;
  }

  const result = await grantInstitutionRepresentation(prisma, {
    institutionId,
    userId: targetUser.id,
    programmeId: programme.id,
    editionId,
    actionScope: value.actionScope,
    validFrom: value.validFrom ?? null,
    validUntil: value.validUntil ?? null,
    basis: value.basis ?? null,
    actorUserId: session.user.id,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(result, { status: 201 });
}
