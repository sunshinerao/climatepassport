import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import {
  projectInstitutionForPurpose,
  resolveInstitutionId,
  resolveInstitutionRepresentation,
} from "@/lib/server/person-institution-governance";

/**
 * CP-TODO-242：机构上下文的最小披露读取（CP-FR-051/052）。
 * 仅持有有效机构代表权（READ 或 MANAGE）的用户或 ADMIN 可读，
 * 返回用途受限投影；任职关系不构成访问依据。匿名 401，越权 403。
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const institutionId = await resolveInstitutionId(prisma, params.id);
  if (!institutionId) return NextResponse.json({ error: "Institution not found." }, { status: 404 });

  if (session.user.role !== "ADMIN") {
    const decision = await resolveInstitutionRepresentation(prisma, {
      userId: session.user.id,
      institutionId,
      action: "read",
    });
    if (!decision.granted) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) return NextResponse.json({ error: "Institution not found." }, { status: 404 });

  const projection = projectInstitutionForPurpose(
    institution as unknown as Record<string, unknown>,
    "institution_context",
  );
  return NextResponse.json({ institution: projection });
}
