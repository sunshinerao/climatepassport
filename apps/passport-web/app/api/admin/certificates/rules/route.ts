import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { isEmptyCertificateCondition } from "@/lib/server/verifier-activity";

const createRuleSchema = z.object({
  name: z.string().trim().min(3).max(120),
  activityId: z.string().uuid(),
  certificateDefinitionId: z.string().uuid(),
  trigger: z.literal("ACTIVITY_CHECKIN"),
  isActive: z.boolean().default(false),
  notifyUser: z.boolean().default(true),
  requiresAdminConfirmation: z.literal(false).default(false),
  conditionJson: z.null().optional(),
});

const updateRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(3).max(120).optional(),
  isActive: z.boolean().optional(),
  notifyUser: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.isActive !== undefined || value.notifyUser !== undefined, {
  message: "At least one editable field is required.",
});

const definitionInclude = {
  template: true,
  category: true,
} as const;

function chainIsEligible(definition: {
  isActive: boolean;
  approvalMode: string;
  template: { isActive: boolean };
  category: { isActive: boolean; autoIssueEnabled: boolean };
}) {
  return definition.isActive
    && definition.approvalMode === "auto"
    && definition.template.isActive
    && definition.category.isActive
    && definition.category.autoIssueEnabled;
}

type SerializableRule = {
  trigger: string;
  requiresAdminConfirmation: boolean;
  conditionJson: unknown;
  isActive: boolean;
  autoIssue: boolean;
  certificateDefinition: {
    isActive: boolean;
    approvalMode: string;
    template: { isActive: boolean };
    category: { isActive: boolean; autoIssueEnabled: boolean };
  };
};

function serializeRule<T extends SerializableRule>(rule: T) {
  const supported = rule.trigger === "ACTIVITY_CHECKIN"
    && !rule.requiresAdminConfirmation
    && isEmptyCertificateCondition(rule.conditionJson);
  const chainEligible = chainIsEligible(rule.certificateDefinition);
  return {
    ...rule,
    supported,
    eligible: supported && chainEligible,
    effective: supported && chainEligible && rule.isActive && rule.autoIssue,
  };
}

export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const activityId = new URL(request.url).searchParams.get("activityId")?.trim();
  if (activityId && !z.string().uuid().safeParse(activityId).success) return NextResponse.json({ error: "Invalid activity id." }, { status: 400 });
  const rules = await prisma.activityCertificateRule.findMany({
    where: activityId ? { activityId } : undefined,
    include: {
      activity: { select: { id: true, title: true, titleEn: true } },
      certificateDefinition: { include: definitionInclude },
      _count: { select: { issuances: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 200,
  });
  return NextResponse.json({
    rules: rules.map(serializeRule),
    capabilities: {
      supportedTriggers: ["ACTIVITY_CHECKIN"],
      unsupportedTriggers: ["COURSE_COMPLETION", "LEARNING_EXPERIENCE_COMPLETION", "POINTS_THRESHOLD", "MANUAL_REVIEW"],
      conditionsSupported: false,
      issueTiming: "IMMEDIATE",
    },
  });
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const queryActivityId = new URL(request.url).searchParams.get("activityId")?.trim();
  const bodyRecord = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const parsed = createRuleSchema.safeParse({ ...bodyRecord, activityId: bodyRecord.activityId ?? queryActivityId ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid rule." }, { status: 400 });
  if (!isEmptyCertificateCondition(parsed.data.conditionJson)) return NextResponse.json({ error: "Activity check-in rules do not support custom conditions." }, { status: 400 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const [activity, definition, duplicate] = await Promise.all([
    prisma.activity.findUnique({ where: { id: parsed.data.activityId }, select: { id: true } }),
    prisma.certificateDefinition.findUnique({ where: { id: parsed.data.certificateDefinitionId }, include: definitionInclude }),
    prisma.activityCertificateRule.findFirst({ where: { activityId: parsed.data.activityId, certificateDefinitionId: parsed.data.certificateDefinitionId, trigger: parsed.data.trigger }, select: { id: true } }),
  ]);
  if (!activity || !definition) return NextResponse.json({ error: "Activity or certificate definition was not found." }, { status: 404 });
  if (duplicate) return NextResponse.json({ error: "This Activity already has a check-in rule for the selected certificate." }, { status: 409 });
  if (parsed.data.isActive && !chainIsEligible(definition)) return NextResponse.json({ error: "An active automatic issuance chain is required before enabling this rule." }, { status: 409 });
  const rule = await prisma.activityCertificateRule.create({
    data: {
      name: parsed.data.name,
      activityId: activity.id,
      certificateDefinitionId: definition.id,
      trigger: parsed.data.trigger,
      conditionJson: Prisma.JsonNull,
      autoIssue: true,
      isActive: parsed.data.isActive,
      notifyUser: parsed.data.notifyUser,
      requiresAdminConfirmation: false,
    },
    include: {
      activity: { select: { id: true, title: true, titleEn: true } },
      certificateDefinition: { include: definitionInclude },
      _count: { select: { issuances: true } },
    },
  });
  await writeCoreAuditLog({ actorUserId: admin.id, action: "certificate.issuing_rule.create", subjectType: "activity_certificate_rule", subjectId: rule.id, result: parsed.data.isActive ? "active" : "draft", metadataJson: { activityId: activity.id, certificateDefinitionId: definition.id, trigger: parsed.data.trigger }, ...getRequestAuditContext(request) });
  return NextResponse.json({ rule: serializeRule(rule) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  const parsed = updateRuleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid rule." }, { status: 400 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const current = await prisma.activityCertificateRule.findUnique({ where: { id: parsed.data.id }, include: { certificateDefinition: { include: definitionInclude } } });
  if (!current) return NextResponse.json({ error: "Issuing rule was not found." }, { status: 404 });
  if (parsed.data.isActive && (!isEmptyCertificateCondition(current.conditionJson) || current.trigger !== "ACTIVITY_CHECKIN" || current.requiresAdminConfirmation || !chainIsEligible(current.certificateDefinition))) {
    return NextResponse.json({ error: "This rule is not supported or its certificate chain is inactive." }, { status: 409 });
  }
  const rule = await prisma.activityCertificateRule.update({
    where: { id: current.id },
    data: {
      name: parsed.data.name,
      isActive: parsed.data.isActive,
      notifyUser: parsed.data.notifyUser,
      autoIssue: true,
    },
    include: {
      activity: { select: { id: true, title: true, titleEn: true } },
      certificateDefinition: { include: definitionInclude },
      _count: { select: { issuances: true } },
    },
  });
  await writeCoreAuditLog({ actorUserId: admin.id, action: "certificate.issuing_rule.update", subjectType: "activity_certificate_rule", subjectId: rule.id, result: rule.isActive ? "active" : "inactive", metadataJson: { activityId: rule.activityId, trigger: rule.trigger }, ...getRequestAuditContext(request) });
  return NextResponse.json({ rule: serializeRule(rule) });
}
