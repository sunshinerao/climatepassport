import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { withdrawConsent } from "@/lib/server/consents";

/** CP-TODO-249：撤回同意（本人或原授予的监护人，立即生效并阻断依赖它的发布）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const result = await withdrawConsent(prisma, {
    consentId: params.id,
    actorUserId: session.user.id,
  });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ consentId: result.consentId });
}
