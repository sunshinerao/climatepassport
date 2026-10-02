import { NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getPrismaClient } from "@/lib/server/prisma";
import { apiForbidden, requireApiUser } from "@/lib/server/api-auth";

async function requireAdminApi() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  return user.role === "ADMIN" ? user : apiForbidden();
}

export async function GET(request: Request) { const user = await requireAdminApi(); if (user instanceof NextResponse) return user; const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 }); return NextResponse.json(await prisma.portfolioRuleSet.findMany({ include: { evidenceRules: { include: { dimension: true } } }, orderBy: { version: "desc" } })); }
export async function POST(request: Request) {
  const user = await requireAdminApi(); if (user instanceof NextResponse) return user; const prisma = getPrismaClient(); if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json().catch(() => null); if (!body || typeof body.name !== "string" || !Array.isArray(body.rules) || body.rules.length === 0) return NextResponse.json({ error: "Invalid rules." }, { status: 400 });
  const dimensions = await prisma.competencyDimension.findMany({ select: { id: true, key: true } }); const validKinds = new Set(["ISSUED_CERTIFICATE", "VERIFIED_ACHIEVEMENT", "LEARNING_COMPLETION", "VERIFIED_ACTIVITY_PARTICIPATION"]);
  const invalidRule = body.rules.some((rule: any) => !dimensions.some((d) => d.key === rule.dimensionKey)
    || !validKinds.has(rule.sourceKind)
    || typeof rule.reason !== "string"
    || rule.reason.length > 500
    || (rule.predicate && (typeof rule.predicate !== "object" || Object.keys(rule.predicate).some((key) => key !== "type"))));
  if (invalidRule) return NextResponse.json({ error: "Rules support only approved source kinds and an optional type predicate." }, { status: 400 });
  const version = (await prisma.portfolioRuleSet.aggregate({ _max: { version: true } }))._max.version ?? 0;
  const ruleSet = await prisma.portfolioRuleSet.create({ data: { version: version + 1, name: body.name.slice(0, 120), createdByUserId: user.id, evidenceRules: { create: body.rules.map((rule: any) => ({ dimensionId: dimensions.find((d) => d.key === rule.dimensionKey)!.id, sourceKind: rule.sourceKind, predicateJson: rule.predicate ?? {}, weight: 1, reason: rule.reason, reasonEn: typeof rule.reasonEn === "string" ? rule.reasonEn : null })) } } });
  await writeCoreAuditLog({ actorUserId: user.id, action: "PORTFOLIO_RULESET_CREATED", subjectType: "PortfolioRuleSet", subjectId: ruleSet.id, result: "SUCCESS", ...getRequestAuditContext(request) }); return NextResponse.json(ruleSet, { status: 201 });
}
