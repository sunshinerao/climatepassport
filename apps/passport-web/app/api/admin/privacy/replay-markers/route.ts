import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { replayPrivacyMarkers } from "@/lib/server/privacy-lifecycle";
import { requireApiRole } from "@/lib/server/api-auth";

/** CP-TODO-257：备份恢复后重放隐私标记（先重放撤回/删除标记，再开放读取）。仅 ADMIN。 */
export async function POST(req: NextRequest) {
  const auth = await requireApiRole(["ADMIN"], req);
  if (auth instanceof NextResponse) return auth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const subjectType = typeof body.subjectType === "string" && body.subjectType ? body.subjectType : undefined;

  const result = await replayPrivacyMarkers(prisma, { subjectType });
  await writeCoreAuditLog({
    actorUserId: auth.id,
    action: "PRIVACY_MARKERS_REPLAYED",
    subjectType: "PrivacyMarker",
    subjectId: subjectType ?? "all",
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: result,
  }).catch(() => undefined);

  return NextResponse.json(result);
}
