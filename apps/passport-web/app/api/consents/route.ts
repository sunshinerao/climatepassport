import { NextRequest, NextResponse } from "next/server";
import { ConsentGrantSchema } from "@climate-passport/passport-contracts";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { grantConsent, listConsentsForSubject } from "@/lib/server/consents";

/** CP-TODO-249：用户面同意授予（本人自授或监护人代授，CP-FR-060）。 */
export async function POST(req: NextRequest) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = ConsentGrantSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });

  const result = await grantConsent(prisma, {
    grantorUserId: session.user.id,
    subjectUserId: parsed.data.subjectUserId,
    purpose: parsed.data.purpose,
    channel: parsed.data.channel ?? null,
    programmeId: parsed.data.programmeId ?? null,
    objectType: parsed.data.objectType ?? null,
    objectId: parsed.data.objectId ?? null,
    validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
    validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
    guardianUserId: parsed.data.guardianUserId ?? null,
    evidenceJson: parsed.data.evidenceJson ?? null,
  });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ consentId: result.consentId, version: result.version }, { status: 201 });
}

/** CP-TODO-249：查询主体（本人或其监护人视角）的同意列表，可按 purpose/status 过滤。 */
export async function GET(req: NextRequest) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const searchParams = new URL(req.url).searchParams;
  const result = await listConsentsForSubject(prisma, {
    subjectUserId: searchParams.get("subjectUserId") ?? session.user.id,
    actorUserId: session.user.id,
    purpose: searchParams.get("purpose") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ consents: result.consents });
}
