import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import {
  resolveInstitutionRepresentation,
  revokeInstitutionRepresentation,
} from "@/lib/server/person-institution-governance";

const revokeSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * CP-TODO-242：撤销机构代表权。ADMIN 或该机构 MANAGE 范围代表人可撤销；
 * compare-and-set 保证撤销一次性且立即生效（CP-FR-051）。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const representation = await prisma.institutionRepresentation.findUnique({
    where: { id: params.id },
    select: { id: true, institutionId: true },
  });
  if (!representation) return NextResponse.json({ error: "Representation not found." }, { status: 404 });

  if (session.user.role !== "ADMIN") {
    const delegation = await resolveInstitutionRepresentation(prisma, {
      userId: session.user.id,
      institutionId: representation.institutionId,
      action: "manage",
    });
    if (!delegation.granted) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = revokeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const result = await revokeInstitutionRepresentation(prisma, {
    representationId: representation.id,
    actorUserId: session.user.id,
    reason: parsed.data.reason,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(result, { status: 200 });
}
