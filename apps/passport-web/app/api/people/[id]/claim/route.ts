import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import {
  claimPersonForUser,
  projectPersonForPurpose,
} from "@/lib/server/person-institution-governance";

const claimSchema = z.object({
  userId: z.string().uuid().optional(),
});

/**
 * CP-TODO-242：Person 认领（CP-FR-052）。
 * 本人认领已确认（VERIFIED）且未关联账号的 Person；ADMIN 可代指定账号认领。
 * 只建立账号关联：不自动开户、不发送邀请。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = claimSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const isAdmin = session.user.role === "ADMIN";
  const targetUserId = isAdmin && parsed.data.userId ? parsed.data.userId : session.user.id;
  if (!isAdmin && parsed.data.userId && parsed.data.userId !== session.user.id) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const result = await claimPersonForUser(prisma, {
    personId: params.id,
    userId: targetUserId,
    actorUserId: session.user.id,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const person = await prisma.person.findUnique({ where: { id: result.personId } });
  const projection = person
    ? projectPersonForPurpose(person as unknown as Record<string, unknown>, "person_identity")
    : null;
  return NextResponse.json({ person: projection }, { status: 200 });
}
