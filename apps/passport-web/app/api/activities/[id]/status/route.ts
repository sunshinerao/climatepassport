import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { status } = body;

  const validStatuses = ["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED", "ARCHIVED"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const existing = await prisma.activity.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const activity = await prisma.activity.update({
    where: { id: params.id },
    data: { status },
  });

  return NextResponse.json({ activity });
}
