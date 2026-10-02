import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { listPublications } from "@/lib/server/publication-gateway";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-251：管理端发布投影列表（按对象/status 过滤）。 */
export async function GET(req: NextRequest) {
  const apiAuth = await requireApiRole(["ADMIN"], req);
  if (apiAuth instanceof NextResponse) return apiAuth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const searchParams = new URL(req.url).searchParams;
  const { publications } = await listPublications(prisma, {
    objectType: searchParams.get("objectType") ?? undefined,
    objectId: searchParams.get("objectId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  return NextResponse.json({ publications });
}
