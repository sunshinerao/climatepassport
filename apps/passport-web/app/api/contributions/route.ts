import { NextRequest, NextResponse } from "next/server";
import { ContributionRecordSchema } from "@climate-passport/passport-contracts";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { listContributionFacts, recordContributionFact } from "@/lib/server/contribution-facts";

/**
 * CP-TODO-253：贡献事实录入（本人自报，或 ADMIN/机构 MANAGE 代表代录）。
 * 初始核验等级恒为 SELF_REPORTED——录入人身份不自动升级为第三方核验。
 */
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = ContributionRecordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const result = await recordContributionFact(
    prisma,
    {
      personId: parsed.data.personId,
      contributionType: parsed.data.contributionType,
      institutionId: parsed.data.institutionId ?? null,
      programmeId: parsed.data.programmeId ?? null,
      sourceType: parsed.data.sourceType ?? null,
      sourceId: parsed.data.sourceId ?? null,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
      quantities: parsed.data.quantities ?? null,
      note: parsed.data.note ?? null,
    },
    { id: currentUser.id, role: currentUser.role }
  );
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ fact: result.fact }, { status: 201 });
}

/** CP-TODO-253：贡献事实列表（适配器读取面；本人/ADMIN 按人，机构事实需 MANAGE 代表权）。 */
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  const institutionId = searchParams.get("institutionId");
  const includeHistory = searchParams.get("includeHistory") === "1";
  if (!personId && !institutionId) {
    return NextResponse.json({ error: "personId or institutionId is required" }, { status: 400 });
  }

  if (personId) {
    const actorPerson = await prisma.person.findUnique({ where: { userId: currentUser.id }, select: { id: true } });
    if (currentUser.role !== "ADMIN" && actorPerson?.id !== personId) {
      return NextResponse.json({ error: "Forbidden", code: "CONTRIBUTION_ACCESS_DENIED" }, { status: 403 });
    }
  } else if (institutionId && currentUser.role !== "ADMIN") {
    const representations = await prisma.institutionRepresentation.findMany({
      where: { userId: currentUser.id, institutionId, status: "ACTIVE" },
    });
    const now = new Date();
    const readable = representations.some(
      (row) =>
        !row.revokedAt &&
        (row.actionScope.includes("READ") || row.actionScope.includes("MANAGE")) &&
        (!row.validFrom || row.validFrom <= now) &&
        (!row.validUntil || row.validUntil > now)
    );
    if (!readable) {
      return NextResponse.json({ error: "Forbidden", code: "CONTRIBUTION_ACCESS_DENIED" }, { status: 403 });
    }
  }

  const { facts } = await listContributionFacts(prisma, { personId: personId ?? undefined, institutionId: institutionId ?? undefined }, { includeHistory });
  return NextResponse.json({ facts });
}
