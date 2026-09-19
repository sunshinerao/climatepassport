import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAuditContext } from "@/lib/server/audit";
import { getCurrentUser, normalizeUserEmail } from "@/lib/server/auth";
import { issueCertificateToRecipient, normalizeManualVariableValues } from "@/lib/server/certificate-issuance";
import { getPrismaClient } from "@/lib/server/prisma";

const issueSchema = z.object({
  email: z.string().trim().email().optional(),
  emails: z.array(z.string().trim().email()).min(1).max(200).optional(),
  templateId: z.string().uuid(),
  editIssueId: z.string().uuid().nullish(),
  issueDate: z.string().trim().max(40).optional(),
  variableValues: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, context) => {
  if (!value.email && (!value.emails || value.emails.length === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email"],
      message: "At least one recipient email is required.",
    });
  }
});

function parseIssuedAt(value: string | undefined) {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }
  const adminUser = admin;

  const body = await request.json().catch(() => null) as unknown;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = issueSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
  const prismaClient = prisma;

  const issuedAt = parseIssuedAt(payload.data.issueDate);
  if (!issuedAt) {
    return NextResponse.json({ error: "Invalid issue date." }, { status: 400 });
  }
  const issuedAtValue = issuedAt;

  const { templateId } = payload.data;
  const { editIssueId } = payload.data;
  const editIssueIdValue = editIssueId ?? undefined;
  const recipientEmails = payload.data.email
    ? [normalizeUserEmail(payload.data.email)]
    : Array.from(new Set((payload.data.emails ?? []).map((email) => normalizeUserEmail(email))));
  const manualVariableValues = normalizeManualVariableValues(payload.data.variableValues);

  if (editIssueId && recipientEmails.length !== 1) {
    return NextResponse.json({ error: "Edit re-issue only supports a single recipient." }, { status: 400 });
  }

  const definition = await prisma.certificateDefinition.findFirst({
    where: { templateId, isActive: true, category: { isActive: true }, template: { isActive: true } },
    include: { category: true, template: true },
  });
  if (!definition) {
    return NextResponse.json({ error: "No active certificate definition found for this template." }, { status: 404 });
  }
  const certificateDefinition = definition;

  const verificationUrlBase = new URL(request.url).origin;
  const auditContext = getRequestAuditContext(request);

  async function issueToRecipient(email: string, issueIdForEdit?: string) {
    const result = await issueCertificateToRecipient(prismaClient, {
      email,
      certificateDefinition: {
        id: certificateDefinition.id,
        name: certificateDefinition.name,
        nameEn: certificateDefinition.nameEn,
        category: { name: certificateDefinition.category.name, nameEn: certificateDefinition.category.nameEn },
        templateId,
        template: {
          renderConfigJson: certificateDefinition.template.renderConfigJson,
          version: certificateDefinition.template.version,
        },
      },
      adminUser: { id: adminUser.id, name: adminUser.name },
      issuedAt: issuedAtValue,
      manualVariableValues,
      verificationUrlBase,
      editIssueId: issueIdForEdit,
      auditContext,
    });

    if (!result.ok) {
      return {
        ok: false as const,
        email,
        status: result.status,
        error: result.error,
        ...(result.issueId ? { issueId: result.issueId } : {}),
        ...(result.verificationCode ? { verificationCode: result.verificationCode } : {}),
      };
    }

    return {
      ok: true as const,
      email,
      issueId: result.issueId,
      verificationCode: result.verificationCode,
      verificationUrl: result.verificationUrl,
      fileName: result.fileName,
    };
  }

  if (recipientEmails.length === 1) {
    const result = await issueToRecipient(recipientEmails[0]!, editIssueIdValue);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          issueId: "issueId" in result ? result.issueId : undefined,
          verificationCode: "verificationCode" in result ? result.verificationCode : undefined,
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      issueId: result.issueId,
      verificationCode: result.verificationCode,
      verificationUrl: result.verificationUrl,
      fileName: result.fileName,
    });
  }

  const results = await Promise.all(recipientEmails.map((email) => issueToRecipient(email)));
  const summary = {
    total: results.length,
    succeeded: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
  };

  return NextResponse.json(
    {
      ok: summary.failed === 0,
      summary,
      results: results.map((item) => ({
        email: item.email,
        issueId: item.ok ? item.issueId : ("issueId" in item ? item.issueId : undefined),
        verificationCode: item.ok ? item.verificationCode : ("verificationCode" in item ? item.verificationCode : undefined),
        error: item.ok ? undefined : item.error,
      })),
    },
    { status: summary.succeeded > 0 ? 200 : 409 },
  );
}
