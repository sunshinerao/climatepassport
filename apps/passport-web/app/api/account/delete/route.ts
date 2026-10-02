import { NextRequest, NextResponse } from "next/server";
import { AccountDeleteSchema } from "@climate-passport/passport-contracts";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { deleteUserAccount } from "@/lib/server/privacy-lifecycle";

/**
 * CP-TODO-257：账户删除（与导出/撤回分开；须显式确认）。
 * 匿名化 User/Person、吊销会话、撤回本人 ACTIVE 记录并落隐私标记；返回受限保留说明。
 */
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = AccountDeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path.includes("confirm")) {
      return NextResponse.json(
        { error: "Deletion requires explicit confirmation (confirm: true). Export first if needed.", code: "PRIVACY_DELETE_CONFIRMATION_REQUIRED" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: issue?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await deleteUserAccount(prisma, { userId: currentUser.id, reason: parsed.data.reason });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  await writeCoreAuditLog({
    actorUserId: currentUser.id,
    action: "ACCOUNT_DELETE_REQUESTED",
    subjectType: "User",
    subjectId: currentUser.id,
    result: "SUCCESS",
    ...getRequestAuditContext(req),
    metadataJson: { withdrawnRecords: result.withdrawnRecords },
  }).catch(() => undefined);

  return NextResponse.json({ deleted: true, withdrawnRecords: result.withdrawnRecords, retentionNotice: result.retentionNotice });
}
