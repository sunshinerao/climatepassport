import { allocateCertificateVerificationCode } from "@/lib/server/certificates";
import { buildCertificatePdfArtifactWithQr, parseCertificateRenderConfig } from "@/lib/server/certificate-module";
import { storeBuiltCertificateArtifact } from "@/lib/server/certificate-artifact-storage";
import { buildIssuedCertificateVariableValues } from "@/lib/server/certificate-variables";
import { createAchievementRecord } from "@/lib/server/achievement-badge";
import { ensurePassportUserByEmail } from "@/lib/server/passport-user-provisioning";
import { normalizeUserEmail } from "@/lib/server/auth";
import type { PrismaClient } from "@prisma/client";

export type IssuanceCertificateDefinition = {
  id: string;
  name: string;
  nameEn: string | null;
  category: { name: string; nameEn: string | null };
  templateId: string;
  template: { renderConfigJson: unknown; version: number };
};

export type IssueCertificateToRecipientInput = {
  email: string;
  certificateDefinition: IssuanceCertificateDefinition;
  adminUser: { id: string; name: string };
  issuedAt: Date;
  manualVariableValues: Record<string, string | string[]>;
  verificationUrlBase: string;
  editIssueId?: string;
  sourceType?: string | null;
  sourceId?: string | null;
  deterministicIssueId?: string;
  skipDuplicateIssueId?: string;
  auditAction?: string;
  auditResult?: string;
  auditMetadata?: Record<string, unknown>;
  auditContext?: { ipAddress?: string | null; userAgent?: string | null };
};

export type IssueCertificateToRecipientResult =
  | {
      ok: true;
      email: string;
      issueId: string;
      verificationCode: string;
      verificationUrl: string;
      fileName: string | null;
      reissued: boolean;
      recipient: { id: string; name: string; normalizedEmail: string; created: boolean; climatePassportId: string | null };
      certificateName: string;
      categoryName: string;
    }
  | { ok: false; email: string; status: number; error: string; issueId?: string; verificationCode?: string };

export function normalizeManualVariableValues(values: Record<string, unknown> | undefined) {
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

export async function issueCertificateToRecipient(
  prisma: PrismaClient,
  input: IssueCertificateToRecipientInput,
): Promise<IssueCertificateToRecipientResult> {
  const email = normalizeUserEmail(input.email);
  const certificateDefinition = input.certificateDefinition;
  const templateId = certificateDefinition.templateId;
  const renderConfig = parseCertificateRenderConfig(certificateDefinition.template.renderConfigJson);

  // Phase 1 (short TX): provision user, check duplicate, allocate verification code.
  // Artifact building is intentionally OUTSIDE the transaction — it is CPU/IO heavy and
  // would exceed Prisma's default 5 s interactive-transaction timeout. The issuance
  // audit write is deliberately INSIDE the Phase 3 transaction: a credential must
  // never be persisted without its audit record (CP-AUD-005).
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
    setup = await prisma.$transaction(async (tx) => {
      const recipient = await ensurePassportUserByEmail(tx, {
        email,
        fallbackName: resolveTextValue(
          input.manualVariableValues.holderName,
          input.manualVariableValues.holderNameEn,
          email.split("@")[0] ?? email,
        ),
        role: "ATTENDEE",
        status: "PENDING",
      });

      const issueToEdit = input.editIssueId
        ? await tx.certificateIssue.findUnique({
            where: { id: input.editIssueId },
            select: { id: true, verificationCode: true, userId: true, status: true },
          })
        : null;

      if (input.editIssueId && !issueToEdit) {
        return { ok: false as const, status: 404, error: "Certificate to edit was not found." };
      }
      if (issueToEdit && issueToEdit.userId !== recipient.id) {
        return { ok: false as const, status: 409, error: "A certificate can only be reissued to its existing holder." };
      }
      if (issueToEdit?.status === "REVOKED") {
        return { ok: false as const, status: 409, error: "Restore a revoked certificate before reissuing it." };
      }

      const duplicateIssue = await tx.certificateIssue.findFirst({
        where: {
          definitionId: certificateDefinition.id,
          userId: recipient.id,
          id: {
            notIn: [issueToEdit?.id, input.skipDuplicateIssueId].filter((value): value is string => Boolean(value)),
          },
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

      const verificationUrl = new URL(`/verify/certificate/${encodeURIComponent(verificationCode)}`, input.verificationUrlBase).toString();
      const baseVariableValues = buildIssuedCertificateVariableValues({
        holderName: recipient.name,
        certificateName: certificateDefinition.nameEn ?? certificateDefinition.name,
        certificateNameZh: certificateDefinition.name,
        certificateNameEn: certificateDefinition.nameEn,
        categoryName: certificateDefinition.category.nameEn ?? certificateDefinition.category.name,
        categoryNameZh: certificateDefinition.category.name,
        categoryNameEn: certificateDefinition.category.nameEn,
        issueDate: input.issuedAt,
        certificateNumber: verificationCode,
        verificationUrl,
        issuerName: renderConfig.issuerName,
        signer: renderConfig.signerName ?? renderConfig.issuerName ?? input.adminUser.name,
      });
      const variableValues = { ...baseVariableValues, ...input.manualVariableValues } as Record<string, unknown>;
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
    return { ok: false, email, status: 500, error: `Certificate issuance failed: ${msg}` };
  }

  if (!setup.ok) {
    return { ...setup, email };
  }

  // Phase 2 (outside TX): build the certificate artifact — this is CPU/IO heavy and must not run inside a transaction.
  let artifact: Awaited<ReturnType<typeof buildCertificatePdfArtifactWithQr>>;
  try {
    artifact = await buildCertificatePdfArtifactWithQr({
      holderName: setup.holderName,
      certificateName: setup.certificateName,
      categoryName: setup.categoryName,
      issueDate: input.issuedAt,
      certificateNumber: setup.verificationCode,
      verificationUrl: setup.verificationUrl,
      renderConfigJson: certificateDefinition.template.renderConfigJson,
      variableValues: setup.variableValues,
    });
  } catch (artifactError) {
    const msg = artifactError instanceof Error ? artifactError.message : String(artifactError);
    console.error("[certificate.issue] artifact build failed:", msg);
    return { ok: false, email, status: 500, error: `Certificate artifact generation failed: ${msg}` };
  }

  const issueId = setup.issueToEditId ?? input.deterministicIssueId ?? crypto.randomUUID();
  let artifactStorage: Awaited<ReturnType<typeof storeBuiltCertificateArtifact>>;
  try { artifactStorage = await storeBuiltCertificateArtifact(issueId, artifact); } catch (error) { return { ok: false, email, status: 503, error: `Certificate artifact storage failed: ${error instanceof Error ? error.message : "unavailable"}` }; }
  // Phase 3: persist the certificate issue record and its audit log in one
  // transaction — a credential must never exist without its issuance audit.
  const issueWriteData = {
    id: issueId,
    definitionId: certificateDefinition.id,
    userId: setup.recipient.id,
    status: "ISSUED" as const,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    approvedBy: input.adminUser.id,
    approvedAt: input.issuedAt,
    issuedAt: input.issuedAt,
    verificationCode: setup.verificationCode,
    ...artifactStorage,
    variableValuesJson: setup.variableValues as object,
    renderSnapshotJson: { schemaVersion: 1, templateId, templateVersion: certificateDefinition.template.version, renderConfigJson: renderConfig, holderName: setup.holderName, certificateName: setup.certificateName, categoryName: setup.categoryName, issueDate: input.issuedAt.toISOString(), variableValues: setup.variableValues } as object,
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
    restoredAt: null,
    restoredByUserId: null,
  };

  const isReissue = Boolean(setup.issueToEditId);
  // Narrowed bindings for use inside the transaction closure (TS does not keep
  // union narrowing of `let` variables captured by callbacks).
  const issueToEditId = setup.issueToEditId;
  const recipient = setup.recipient;

  let issue: { id: string; verificationCode: string | null; generatedFileName: string | null };
  try {
    issue = await prisma.$transaction(async (tx) => {
      const written = issueToEditId
        ? await tx.certificateIssue.update({
            where: { id: issueToEditId },
            data: issueWriteData,
            select: { id: true, verificationCode: true, generatedFileName: true },
          })
        : await tx.certificateIssue.create({
            data: issueWriteData,
            select: { id: true, verificationCode: true, generatedFileName: true },
          });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.adminUser.id,
          action: input.auditAction ?? (isReissue ? "certificate.reissue" : "certificate.issue"),
          subjectType: "certificate_issue",
          subjectId: written.id,
          result: input.auditResult ?? (isReissue ? "reissued" : "issued"),
          metadataJson: {
            definitionId: certificateDefinition.id,
            templateId,
            editIssueId: issueToEditId,
            recipientUserId: recipient.id,
            recipientEmail: recipient.normalizedEmail,
            recipientCreated: recipient.created,
            recipientClimatePassportId: recipient.climatePassportId,
            fileName: artifact.fileName,
            pdfFileName: artifact.pdfFileName,
            mimeType: artifact.mimeType,
            ...input.auditMetadata,
          },
          ipAddress: input.auditContext?.ipAddress ?? null,
          userAgent: input.auditContext?.userAgent ?? null,
        },
      });
      return written;
    });
  } catch (writeError) {
    const msg = writeError instanceof Error ? writeError.message : String(writeError);
    console.error("[certificate.issue] issue write failed:", msg);
    return { ok: false, email, status: 500, error: `Certificate issuance failed: ${msg}` };
  }

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
    completedAt: input.issuedAt,
    skillTags: ["certificate"],
    topicTags: [setup.categoryName],
    sdgTags: ["SDG13"],
  });

  return {
    ok: true,
    email,
    issueId: issue.id,
    verificationCode: issue.verificationCode ?? setup.verificationCode,
    verificationUrl: setup.verificationUrl,
    fileName: issue.generatedFileName,
    reissued: isReissue,
    recipient: setup.recipient,
    certificateName: setup.certificateName,
    categoryName: setup.categoryName,
  };
}
