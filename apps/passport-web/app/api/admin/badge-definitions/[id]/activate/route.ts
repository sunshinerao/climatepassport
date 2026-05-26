import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/badges/definitions");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const definition = await prisma.badgeDefinition.update({
    where: { id: params.id },
    data: { isActive: true },
  });

  return NextResponse.json({ ok: true, definition });
}
