import { NextRequest, NextResponse } from "next/server";
import { ContributionWithdrawSchema } from "@climate-passport/passport-contracts";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { withdrawContributionFact } from "@/lib/server/contribution-facts";

/** CP-TODO-253：撤回（幂等；撤回事实立即从派生统计中消失——撤销可复算）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = ContributionWithdrawSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await withdrawContributionFact(
    prisma,
    { factId: params.id, reason: parsed.data.reason },
    { id: currentUser.id, role: currentUser.role }
  );
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ fact: result.fact, withdrawn: result.withdrawn });
}
