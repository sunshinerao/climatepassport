import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser, normalizeUserEmail } from "@/lib/server/auth";
import { allocateCertificateVerificationCode } from "@/lib/server/certificates";
import { buildCertificateArtifactWithQr, parseCertificateRenderConfig } from "@/lib/server/certificate-module";
import { buildIssuedCertificateVariableValues } from "@/lib/server/certificate-variables";
import { ensurePassportUserByEmail } from "@/lib/server/passport-user-provisioning";
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

function normalizeManualVariableValues(values: Record<string, unknown> | undefined) {
  const normalized: Record<string, string | string[]> = {};

  for (const [key, rawValue] of Object.entries(values ?? {})) {
    if (Array.isArray(rawValue)) {
      const entries = rawValue
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean);
      if (entries.length > 0) {
        normalized[key] = entries;
      }
      continue;
    }

    const text = String(rawValue ?? "").trim();
    if (text) {
      normalized[key] = text;
    }
  }

  return normalized;
}

function resolveTextValue(...values: Array<string | string[] | null | undefined>) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const text = value.join(", ").trim();
      if (text) {
        return text;
      }
      continue;
    }

    if (typeof value === "string") {
      const text = value.trim();
      if (text) {
        return text;
      }
    }
  }

  return "";
}

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
    where: { templateId, isActive: true },
    include: { category: true, template: true },
  });
  if (!definition) {
    return NextResponse.json({ error: "No active certificate definition found for this template." }, { status: 404 });
  }
  const certificateDefinition = definition;

  const renderConfig = parseCertificateRenderConfig(definition.template.renderConfigJson);

  async function issueToRecipient(email: string, issueIdForEdit?: string) {
    // Phase 1: DB work inside transaction (user provisioning, duplicate check, code allocation, issue write)
    // writeCoreAuditLog is intentionally called OUTSIDE the transaction to avoid
    // a failed audit write rolling back an otherwise successful certificate issuance.
    type TxResult =
      | { ok: true; issueId: string; verificationCode: string; verificationUrl: string; fileName: string | null; auditMeta: Record<string, unknown>; isReissue: boolean }
      | { ok: false; status: number; error: string; issueId?: string; verificationCode?: string };

    let txResult: TxResult;
    try {
      txResult = await prismaClient.$transaction(async (tx) => {
        const recipient = await ensurePassportUserByEmail(tx, {
          email,
          fallbackName: resolveTextValue(
            manualVariableValues.holderName,
            manualVariableValues.holderNameEn,
            email.split("@")[0] ?? email,
          ),
          role: "ATTENDEE",
          status: "PENDING",
        });

        const issueToEdit = issueIdForEdit
          ? await tx.certificateIssue.findUnique({
              where: { id: issueIdForEdit },
              select: { id: true, verificationCode: true },
            })
          : null;

        if (issueIdForEdit && !issueToEdit) {
          return { ok: false as const, status: 404, error: "Certificate to edit was not found." };
        }

        const duplicateIssue = await tx.certificateIssue.findFirst({
          where: {
            definitionId: certificateDefinition.id,
            userId: recipient.id,
            id: issueToEdit ? { not: issueToEdit.id } : undefined,
          },
          select: { id: true, verificationCode: true },
        });

        if (duplicateIssue) {
          return {
            ok: false as const,
            status: 409,
            error: "Duplicate issuance is not allowed for this user and certificate definition.",
            issueId: duplicateIssue.id,
            verificationCode: duplicateIssue.verificationCode ?? undefined,
          };
        }

        const verificationCode = issueToEdit?.verificationCode ?? await allocateCertificateVerificationCode(async (candidate) => {
          const existing = await tx.certificateIssue.findUnique({
            where: { verificationCode: candidate },
            select: { id: true },
          });

          return Boolean(existing);
        });

        const verificationUrl = new URL(`/verify/certificate/${encodeURIComponent(verificationCode)}`, request.url).toString();
        const baseVariableValues = buildIssuedCertificateVariableValues({
          holderName: recipient.name,
          certificateName: certificateDefinition.nameEn ?? certificateDefinition.name,
          certificateNameZh: certificateDefinition.name,
          certificateNameEn: certificateDefinition.nameEn,
          categoryName: certificateDefinition.category.nameEn ?? certificateDefinition.category.name,
          categoryNameZh: certificateDefinition.category.name,
          categoryNameEn: certificateDefinition.category.nameEn,
          issueDate: issuedAtValue,
          certificateNumber: verificationCode,
          verificationUrl,
          issuerName: renderConfig.issuerName,
          signer: renderConfig.signerName ?? renderConfig.issuerName ?? adminUser.name,
        });
        const variableValues = {
          ...baseVariableValues,
          ...manualVariableValues,
        };
        const holderName = resolveTextValue(variableValues.holderName, recipient.name);
        const certificateName = resolveTextValue(
          variableValues.certificateName,
          variableValues.certificateNameEn,
          certificateDefinition.nameEn,
          certificateDefinition.name,
        );
        const categoryName = resolveTextValue(
          variableValues.categoryName,
          variableValues.categoryNameEn,
          certificateDefinition.category.nameEn,
          certificateDefinition.category.name,
        );

        const artifact = await buildCertificateArtifactWithQr({
          holderName,
          certificateName,
          categoryName,
          issueDate: issuedAtValue,
          certificateNumber: verificationCode,
          verificationUrl,
          renderConfigJson: certificateDefinition.template.renderConfigJson,
          variableValues,
        });

        const issueWriteData = {
          definitionId: certificateDefinition.id,
          userId: recipient.id,
          status: "ISSUED" as const,
          approvedBy: adminUser.id,
          approvedAt: issuedAtValue,
          issuedAt: issuedAtValue,
          verificationCode,
          generatedFileName: artifact.fileName,
          generatedFileUrl: artifact.dataUrl,
          variableValuesJson: variableValues,
        };

        const issue = issueToEdit
          ? await tx.certificateIssue.update({
              where: { id: issueToEdit.id },
              data: issueWriteData,
              select: { id: true, verificationCode: true, generatedFileName: true },
            })
          : await tx.certificateIssue.create({
              data: issueWriteData,
              select: { id: true, verificationCode: true, generatedFileName: true },
            });

        return {
          ok: true as const,
          issueId: issue.id,
          verificationCode: issue.verificationCode ?? verificationCode,
          verificationUrl,
          fileName: issue.generatedFileName,
          isReissue: Boolean(issueToEdit),
          auditMeta: {
            definitionId: certificateDefinition.id,
            templateId,
            editIssueId: issueToEdit?.id,
            recipientUserId: recipient.id,
            recipientEmail: recipient.normalizedEmail,
            recipientCreated: recipient.created,
            recipientClimatePassportId: recipient.climatePassportId,
            fileName: artifact.fileName,
            pdfFileName: artifact.pdfFileName,
            mimeType: artifact.mimeType,
          },
        };
      });
    } catch (txError) {
      const msg = txError instanceof Error ? txError.message : String(txError);
      console.error("[certificate.issue] transaction failed:", msg);
      return { ok: false as const, email, status: 500, error: `Certificate issuance failed: ${msg}` };
    }

    // Phase 2: Write audit log outside transaction (best-effort; failure does not affect issuance result)
    if (txResult.ok) {
      void writeCoreAuditLog({
        actorUserId: adminUser.id,
        action: txResult.isReissue ? "certificate.reissue" : "certificate.issue",
        subjectType: "certificate_issue",
        subjectId: txResult.issueId,
        result: txResult.isReissue ? "reissued" : "issued",
        metadataJson: txResult.auditMeta,
        ...getRequestAuditContext(request),
      }).catch((auditError: unknown) => {
        console.error("[certificate.issue] audit log write failed:", auditError instanceof Error ? auditError.message : String(auditError));
      });
    }

    return { ...txResult, email };
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
