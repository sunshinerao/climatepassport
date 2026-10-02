import { NextRequest, NextResponse } from "next/server";
import { ContributionEvaluateSchema } from "@climate-passport/passport-contracts";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { evaluateContributionFact } from "@/lib/server/contribution-facts";

/** CP-TODO-253：核验等级评估（仅升不降；本人不得评估自己——自报不升级第三方核验）。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = ContributionEvaluateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await evaluateContributionFact(
    prisma,
    { factId: params.id, verificationLevel: parsed.data.verificationLevel, reason: parsed.data.reason },
    { id: currentUser.id, role: currentUser.role }
  );
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ fact: result.fact, upgraded: result.upgraded });
}
