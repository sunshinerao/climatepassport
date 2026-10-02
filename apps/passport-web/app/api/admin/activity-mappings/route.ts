import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { listActivityMappings } from "@/lib/server/source-activity-mapping";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-245：管理端来源映射列表（ADMIN）。 */
export async function GET(req: NextRequest) {
  const apiAuth = await requireApiRole(["ADMIN"], req);
  if (apiAuth instanceof NextResponse) return apiAuth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const searchParams = new URL(req.url).searchParams;
  const { mappings } = await listActivityMappings(prisma, {
    programmeId: searchParams.get("programmeId") ?? undefined,
    activityId: searchParams.get("activityId") ?? undefined,
  });
  return NextResponse.json({ mappings });
}
