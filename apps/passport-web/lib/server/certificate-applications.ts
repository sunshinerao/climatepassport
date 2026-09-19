import { Prisma, PrismaClient } from "@prisma/client";
import { allocateCertificateVerificationCode } from "@/lib/server/certificates";
import { buildCertificatePdfArtifactWithQr, parseCertificateRenderConfig } from "@/lib/server/certificate-module";
import { buildIssuedCertificateVariableValues } from "@/lib/server/certificate-variables";
import { storeBuiltCertificateArtifact } from "@/lib/server/certificate-artifact-storage";
import { createCertificateRenderSnapshot } from "@/lib/server/certificate-snapshot";

export const OPEN_APPLICATION_STATUSES = ["DRAFT", "SUBMITTED", "NEEDS_INFORMATION"] as const;

export function applicationEligibilityWhere(definitionId?: string) {
  return {
    ...(definitionId ? { id: definitionId } : {}),
    isActive: true,
    template: { isActive: true },
    category: { isActive: true, userRequestEnabled: true },
  };
}

export async function approveCertificateApplication(input: {
  prisma: PrismaClient;
  applicationId: string;
  reviewer: { id: string; name: string };
  requestUrl: string;
  audit: { ipAddress: string | null; userAgent: string | null };
}) {
  const { prisma, applicationId, reviewer } = input;
  const application = await prisma.certificateApplication.findUnique({
    where: { id: applicationId },
    include: { applicant: true, definition: { include: { category: true, template: true } } },
  });
  if (!application) return { error: "Application not found.", status: 404 };
  if (application.certificateIssueId) return { application, issueId: application.certificateIssueId };
  if (application.status !== "SUBMITTED") return { error: "Only submitted applications can be approved.", status: 409 };

  const definition = application.definition;
  const renderConfig = parseCertificateRenderConfig(definition.template.renderConfigJson);
  const verificationCode = await allocateCertificateVerificationCode(async (candidate) => Boolean(await prisma.certificateIssue.findUnique({ where: { verificationCode: candidate }, select: { id: true } })));
  const verificationUrl = new URL(`/verify/certificate/${encodeURIComponent(verificationCode)}`, input.requestUrl).toString();
  // This timestamp deliberately precedes rendering and is persisted unchanged in
  // the issue and snapshot, so the artifact and credential record agree.
  const issuedAt = new Date();
  const variableValues = buildIssuedCertificateVariableValues({
    holderName: application.applicant.name, certificateName: definition.nameEn ?? definition.name,
    certificateNameZh: definition.name, certificateNameEn: definition.nameEn,
    categoryName: definition.category.nameEn ?? definition.category.name, categoryNameZh: definition.category.name,
    categoryNameEn: definition.category.nameEn, issueDate: issuedAt, certificateNumber: verificationCode,
    verificationUrl, issuerName: renderConfig.issuerName, signer: renderConfig.signerName ?? renderConfig.issuerName ?? reviewer.name,
  });
  let artifact: Awaited<ReturnType<typeof buildCertificatePdfArtifactWithQr>>;
  try {
    artifact = await buildCertificatePdfArtifactWithQr({ holderName: application.applicant.name, certificateName: definition.nameEn ?? definition.name, categoryName: definition.category.nameEn ?? definition.category.name, issueDate: issuedAt, certificateNumber: verificationCode, verificationUrl, renderConfigJson: definition.template.renderConfigJson, variableValues });
  } catch (error) {
    return { error: `Certificate artifact generation failed: ${error instanceof Error ? error.message : String(error)}`, status: 500 };
  }
  const issueId = crypto.randomUUID();
  let artifactStorage: Awaited<ReturnType<typeof storeBuiltCertificateArtifact>>;
  try { artifactStorage = await storeBuiltCertificateArtifact(issueId, artifact); } catch (error) { return { error: `Certificate artifact storage failed: ${error instanceof Error ? error.message : "unavailable"}`, status: 503 }; }
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.certificateApplication.findUnique({ where: { id: applicationId }, include: { definition: { include: { category: true, template: true } } } });
      if (!current) return { error: "Application not found.", status: 404 };
      if (current.certificateIssueId) return { application: current, issueId: current.certificateIssueId };
      if (current.status !== "SUBMITTED" || !current.definition.isActive || !current.definition.template.isActive || !current.definition.category.isActive || !current.definition.category.userRequestEnabled) return { error: "Application is no longer eligible for approval.", status: 409 };
      const issue = await tx.certificateIssue.create({ data: { id: issueId, definitionId: current.definitionId, userId: current.applicantId, sourceType: "CERTIFICATE_APPLICATION", sourceId: current.id, status: "ISSUED", approvedBy: reviewer.id, approvedAt: issuedAt, issuedAt, verificationCode, ...artifactStorage, variableValuesJson: variableValues as Prisma.InputJsonValue, renderSnapshotJson: createCertificateRenderSnapshot({ templateId: current.definition.templateId, templateVersion: current.definition.template.version, renderConfigJson: renderConfig, holderName: application.applicant.name, certificateName: definition.nameEn ?? definition.name, categoryName: definition.category.nameEn ?? definition.category.name, issueDate: issuedAt.toISOString(), variableValues }) as Prisma.InputJsonValue } });
      const updated = await tx.certificateApplication.update({ where: { id: current.id }, data: { status: "APPROVED", reviewerId: reviewer.id, reviewedAt: issuedAt, certificateIssueId: issue.id } });
      await tx.certificateApplicationEvent.create({ data: { applicationId: current.id, actorUserId: reviewer.id, fromStatus: "SUBMITTED", toStatus: "APPROVED", kind: "APPROVE_AND_ISSUE" } });
      await tx.coreAuditLog.create({ data: { actorUserId: reviewer.id, action: "certificate_application.approve_and_issue", subjectType: "certificate_application", subjectId: current.id, result: "approved", ipAddress: input.audit.ipAddress, userAgent: input.audit.userAgent, metadataJson: { definitionId: current.definitionId, certificateIssueId: issue.id } } });
      await tx.notification.create({ data: { userId: current.applicantId, channel: "IN_APP", kind: "CERTIFICATE", title: "Certificate request approved", titleEn: "Certificate request approved", body: "Your certificate request was approved and issued.", bodyEn: "Your certificate request was approved and issued.", actionUrl: "/dashboard/certificates", metadata: { applicationId: current.id, certificateIssueId: issue.id } } });
      return { application: updated, issueId: issue.id };
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: string }).code : undefined;
    if (code === "P2002" || code === "P2034") {
      const current = await prisma.certificateApplication.findUnique({ where: { id: applicationId }, select: { certificateIssueId: true } });
      if (current?.certificateIssueId) return { application: current, issueId: current.certificateIssueId };
    }
    throw error;
  }
}
