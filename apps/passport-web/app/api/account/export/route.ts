import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { exportUserData } from "@/lib/server/privacy-lifecycle";

/** CP-TODO-257：本人数据导出（仅本人有权材料及索引，不带其他作者私密内容）。 */
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const result = await exportUserData(prisma, { userId: currentUser.id });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json(result.export, {
    headers: {
      "Content-Disposition": `attachment; filename="climate-passport-export-${currentUser.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
