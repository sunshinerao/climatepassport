import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { listDecisionReceipts } from "@/lib/server/external-decision-receipts";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-250：管理端决定回执列表（按对象/用途/issuer 过滤）。 */
export async function GET(req: NextRequest) {
  const apiAuth = await requireApiRole(["ADMIN"], req);
  if (apiAuth instanceof NextResponse) return apiAuth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const searchParams = new URL(req.url).searchParams;
  const { receipts } = await listDecisionReceipts(prisma, {
    objectType: searchParams.get("objectType") ?? undefined,
    objectId: searchParams.get("objectId") ?? undefined,
    purpose: searchParams.get("purpose") ?? undefined,
    issuerKey: searchParams.get("issuerKey") ?? undefined,
  });
  return NextResponse.json({ receipts });
}
