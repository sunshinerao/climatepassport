import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiRole } from "@/lib/server/api-auth";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const apiAuth = await requireApiRole(["ADMIN"], _request);
  if (apiAuth instanceof NextResponse) return apiAuth;
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
