import { Prisma } from "@prisma/client";
import { buildCertificatePdfArtifactWithQr, parseCertificateRenderConfig } from "@/lib/server/certificate-module";
import { allocateCertificateVerificationCode } from "@/lib/server/certificates";
import { buildIssuedCertificateVariableValues } from "@/lib/server/certificate-variables";
import { getPrismaClient } from "@/lib/server/prisma";
import { isEmptyCertificateCondition } from "@/lib/server/verifier-activity";
import { storeBuiltCertificateArtifact } from "@/lib/server/certificate-artifact-storage";

const MAX_TRANSACTION_ATTEMPTS = 3;

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Certificate rendering failed.";
  return message.replace(/[\r\n\t]/g, " ").slice(0, 300);
}

export async function finalizeActivityCheckinCertificateIssuance(issuanceId: string) {
  const prisma = getPrismaClient();
  if (!prisma) return { status: "unavailable" as const };

  const issuance = await prisma.activityCertificateIssuance.findUnique({
    where: { id: issuanceId },
    include: {
      activity: { select: { id: true, title: true, titleEn: true } },
      participation: { select: { id: true, userId: true } },
      checkinRecord: { select: { id: true, checkinAt: true } },
      rule: { select: { id: true, trigger: true, autoIssue: true, isActive: true, notifyUser: true, requiresAdminConfirmation: true, conditionJson: true } },
      certificateDefinition: { include: { category: true, template: true } },
    },
  });
  if (!issuance) return { status: "not_found" as const };
  if (issuance.status === "ISSUED") return { status: "issued" as const };
  if (issuance.status === "FAILED") return { status: "failed" as const };

  const eligible = issuance.rule.trigger === "ACTIVITY_CHECKIN"
    && issuance.rule.autoIssue
    && issuance.rule.isActive
    && !issuance.rule.requiresAdminConfirmation
    && isEmptyCertificateCondition(issuance.rule.conditionJson)
    && issuance.certificateDefinition.isActive
    && issuance.certificateDefinition.approvalMode === "auto"
    && issuance.certificateDefinition.template.isActive
    && issuance.certificateDefinition.category.isActive
    && issuance.certificateDefinition.category.autoIssueEnabled;
  if (!eligible) {
    await prisma.activityCertificateIssuance.update({ where: { id: issuance.id }, data: { status: "FAILED", attemptCount: { increment: 1 }, error: "Issuance configuration is no longer eligible." } });
    return { status: "failed" as const };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: issuance.participation.userId }, select: { name: true } });
    if (!user) throw new Error("Certificate holder is unavailable.");
    const verificationCode = await allocateCertificateVerificationCode(async (candidate) => Boolean(await prisma.certificateIssue.findUnique({ where: { verificationCode: candidate }, select: { id: true } })));
    const issuedAt = issuance.checkinRecord.checkinAt;
    const verificationUrl = new URL(`/verify/certificate/${encodeURIComponent(verificationCode)}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
    const variableValues = buildIssuedCertificateVariableValues({
      holderName: user.name,
      certificateName: issuance.certificateDefinition.nameEn ?? issuance.certificateDefinition.name,
      certificateNameZh: issuance.certificateDefinition.name,
      certificateNameEn: issuance.certificateDefinition.nameEn,
      categoryName: issuance.certificateDefinition.category.nameEn ?? issuance.certificateDefinition.category.name,
      categoryNameZh: issuance.certificateDefinition.category.name,
      categoryNameEn: issuance.certificateDefinition.category.nameEn,
      issueDate: issuedAt,
      certificateNumber: verificationCode,
      verificationUrl,
    });
    const holderName = user.name;
    const certificateName = issuance.certificateDefinition.nameEn ?? issuance.certificateDefinition.name;
    const categoryName = issuance.certificateDefinition.category.nameEn ?? issuance.certificateDefinition.category.name;
    // Persist the normalized safe render contract, never a mutable template reference.
    const renderConfigJson = parseCertificateRenderConfig(issuance.certificateDefinition.template.renderConfigJson);
    const artifact = await buildCertificatePdfArtifactWithQr({ holderName, certificateName, categoryName, issueDate: issuedAt, certificateNumber: verificationCode, verificationUrl, renderConfigJson, variableValues });
    const issueId = crypto.randomUUID();
    const artifactStorage = await storeBuiltCertificateArtifact(issueId, artifact);

    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const current = await tx.activityCertificateIssuance.findUnique({ where: { id: issuance.id }, select: { status: true, certificateIssueId: true } });
          if (!current || current.status === "ISSUED") return current?.status === "ISSUED" ? "issued" : "missing";
          const issue = await tx.certificateIssue.create({ data: { id: issueId,
            definitionId: issuance.certificateDefinitionId, userId: issuance.participation.userId,
            sourceType: "ACTIVITY_CHECKIN", sourceId: `activity-checkin-issuance:${issuance.id}`, status: "ISSUED", verificationCode,
            ...artifactStorage, variableValuesJson: variableValues,
            renderSnapshotJson: {
              schemaVersion: 1,
              templateId: issuance.certificateDefinition.templateId,
              templateVersion: issuance.certificateDefinition.template.version,
              renderConfigJson,
              holderName,
              certificateName,
              categoryName,
              issuedAt: issuedAt.toISOString(),
              variableValues,
              activityId: issuance.activityId,
              participationId: issuance.participationId,
              checkinRecordId: issuance.checkinRecordId,
              ruleId: issuance.ruleId,
              issuanceId: issuance.id,
            } as Prisma.InputJsonValue, issuedAt,
          } });
          await tx.activityCertificateIssuance.update({ where: { id: issuance.id }, data: { status: "ISSUED", certificateIssueId: issue.id, issuedAt, attemptCount: { increment: 1 }, error: null } });
          await tx.coreAuditLog.create({ data: { action: "certificate.activity_checkin_issued", subjectType: "activity_certificate_issuance", subjectId: issuance.id, result: "issued", metadataJson: { activityId: issuance.activityId, ruleId: issuance.ruleId } } });
          if (issuance.rule.notifyUser) {
            await tx.notification.create({ data: { userId: issuance.participation.userId, kind: "CERTIFICATE", title: "Certificate issued", body: "Your activity check-in certificate is ready.", actionUrl: "/certificates", metadata: { sourceType: "ACTIVITY_CHECKIN" } } });
          }
          return "issued";
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return { status: result === "issued" ? "issued" as const : "failed" as const };
      } catch (error) {
        if (attempt + 1 === MAX_TRANSACTION_ATTEMPTS) throw error;
      }
    }
  } catch (error) {
    await prisma.activityCertificateIssuance.update({ where: { id: issuance.id }, data: { status: "FAILED", attemptCount: { increment: 1 }, error: safeError(error) } });
  }
  return { status: "failed" as const };
}
