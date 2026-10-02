import { NextRequest, NextResponse } from "next/server";
import { ContributionCorrectSchema } from "@climate-passport/passport-contracts";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { correctContributionFact } from "@/lib/server/contribution-facts";

/** CP-TODO-253：更正（原行转 CORRECTED，successor 接续同自然键；派生统计即时复算）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = ContributionCorrectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await correctContributionFact(
    prisma,
    {
      factId: params.id,
      quantities: parsed.data.quantities ?? null,
      note: parsed.data.note ?? null,
      reason: parsed.data.reason,
    },
    { id: currentUser.id, role: currentUser.role }
  );
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ fact: result.fact, correctedFactId: result.correctedFactId });
}
