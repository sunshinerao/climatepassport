import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser, normalizeUserEmail } from "@/lib/server/auth";
import { allocateCertificateVerificationCode } from "@/lib/server/certificates";
import { buildCertificateArtifactWithQr, parseCertificateRenderConfig } from "@/lib/server/certificate-module";
import { buildIssuedCertificateVariableValues } from "@/lib/server/certificate-variables";
import { createAchievementRecord } from "@/lib/server/achievement-badge";
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
    // Phase 1 (short TX): provision user, check duplicate, allocate verification code.
    // Artifact building is intentionally OUTSIDE the transaction — it is CPU/IO heavy and
    // would exceed Prisma's default 5 s interactive-transaction timeout.
    // writeCoreAuditLog is also OUTSIDE the transaction to avoid a failed audit write
    // rolling back an otherwise successful certificate issuance.
    type SetupResult =
      | {
          ok: true;
          recipient: { id: string; name: string; normalizedEmail: string; created: boolean; climatePassportId: string | null };
          verificationCode: string;
          verificationUrl: string;
          variableValues: Record<string, unknown>;
          holderName: string;
          certificateName: string;
          categoryName: string;
          issueToEditId: string | undefined;
        }
      | { ok: false; status: number; error: string; issueId?: string; verificationCode?: string };

    let setup: SetupResult;
    try {
      setup = await prismaClient.$transaction(async (tx) => {
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
        const variableValues = { ...baseVariableValues, ...manualVariableValues } as Record<string, unknown>;
        const holderName = resolveTextValue((variableValues.holderName as string | undefined), recipient.name);
        const certificateName = resolveTextValue(
          variableValues.certificateName as string | undefined,
          variableValues.certificateNameEn as string | undefined,
          certificateDefinition.nameEn,
          certificateDefinition.name,
        );
        const categoryName = resolveTextValue(
          variableValues.categoryName as string | undefined,
          variableValues.categoryNameEn as string | undefined,
          certificateDefinition.category.nameEn,
          certificateDefinition.category.name,
        );

        return {
          ok: true as const,
          recipient,
          verificationCode,
          verificationUrl,
          variableValues,
          holderName,
          certificateName,
          categoryName,
          issueToEditId: issueToEdit?.id,
        };
      });
    } catch (setupError) {
      const msg = setupError instanceof Error ? setupError.message : String(setupError);
      console.error("[certificate.issue] setup transaction failed:", msg);
      return { ok: false as const, email, status: 500, error: `Certificate issuance failed: ${msg}` };
    }

    if (!setup.ok) {
      return { ...setup, email };
    }

    // Phase 2 (outside TX): build the certificate artifact — this is CPU/IO heavy and must not run inside a transaction.
    let artifact: Awaited<ReturnType<typeof buildCertificateArtifactWithQr>>;
    try {
      artifact = await buildCertificateArtifactWithQr({
        holderName: setup.holderName,
        certificateName: setup.certificateName,
        categoryName: setup.categoryName,
        issueDate: issuedAtValue,
        certificateNumber: setup.verificationCode,
        verificationUrl: setup.verificationUrl,
        renderConfigJson: certificateDefinition.template.renderConfigJson,
        variableValues: setup.variableValues,
      });
    } catch (artifactError) {
      const msg = artifactError instanceof Error ? artifactError.message : String(artifactError);
      console.error("[certificate.issue] artifact build failed:", msg);
      return { ok: false as const, email, status: 500, error: `Certificate artifact generation failed: ${msg}` };
    }

    // Phase 3 (single DB write, no TX needed): persist the certificate issue record.
    const issueWriteData = {
      definitionId: certificateDefinition.id,
      userId: setup.recipient.id,
      status: "ISSUED" as const,
      approvedBy: adminUser.id,
      approvedAt: issuedAtValue,
      issuedAt: issuedAtValue,
      verificationCode: setup.verificationCode,
      generatedFileName: artifact.fileName,
      generatedFileUrl: artifact.dataUrl,
      variableValuesJson: setup.variableValues as object,
    };

    let issue: { id: string; verificationCode: string | null; generatedFileName: string | null };
    try {
      issue = setup.issueToEditId
        ? await prismaClient.certificateIssue.update({
            where: { id: setup.issueToEditId },
            data: issueWriteData,
            select: { id: true, verificationCode: true, generatedFileName: true },
          })
        : await prismaClient.certificateIssue.create({
            data: issueWriteData,
            select: { id: true, verificationCode: true, generatedFileName: true },
          });
    } catch (writeError) {
      const msg = writeError instanceof Error ? writeError.message : String(writeError);
      console.error("[certificate.issue] issue write failed:", msg);
      return { ok: false as const, email, status: 500, error: `Certificate issuance failed: ${msg}` };
    }

    const isReissue = Boolean(setup.issueToEditId);

    // Phase 4: Write audit log (best-effort; failure does not affect issuance result).
    void writeCoreAuditLog({
      actorUserId: adminUser.id,
      action: isReissue ? "certificate.reissue" : "certificate.issue",
      subjectType: "certificate_issue",
      subjectId: issue.id,
      result: isReissue ? "reissued" : "issued",
      metadataJson: {
        definitionId: certificateDefinition.id,
        templateId,
        editIssueId: setup.issueToEditId,
        recipientUserId: setup.recipient.id,
        recipientEmail: setup.recipient.normalizedEmail,
        recipientCreated: setup.recipient.created,
        recipientClimatePassportId: setup.recipient.climatePassportId,
        fileName: artifact.fileName,
        pdfFileName: artifact.pdfFileName,
        mimeType: artifact.mimeType,
      },
      ...getRequestAuditContext(request),
    }).catch((auditError: unknown) => {
      console.error("[certificate.issue] audit log write failed:", auditError instanceof Error ? auditError.message : String(auditError));
    });

    await createAchievementRecord({
      userId: setup.recipient.id,
      name: setup.certificateName,
      description: `Certificate ${isReissue ? "reissued" : "issued"}: ${setup.categoryName}`,
      type: "VERIFIED",
      sourceType: "CERTIFICATE_ISSUED",
      sourceId: `certificate:${issue.id}`,
      verificationLevel: "INSTITUTION_VERIFIED",
      points: 80,
      relatedCertificateId: issue.id,
      completedAt: issuedAtValue,
      skillTags: ["certificate"],
      topicTags: [setup.categoryName],
      sdgTags: ["SDG13"],
    });

    return {
      ok: true as const,
      email,
      issueId: issue.id,
      verificationCode: issue.verificationCode ?? setup.verificationCode,
      verificationUrl: setup.verificationUrl,
      fileName: issue.generatedFileName,
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
