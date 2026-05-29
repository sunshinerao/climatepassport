import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const ASSIGNABLE_ROLES = ["ATTENDEE", "EVENT_MANAGER", "VERIFIER"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { role } = body;

  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, role: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Prevent downgrading ADMIN accounts via this endpoint
  if (user.role === "ADMIN") {
    return NextResponse.json({ error: "Cannot change role of an ADMIN account" }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ user: updated });
}
