import { NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { buildCertificateArtifactWithQr, parseCertificateRenderConfig } from "@/lib/server/certificate-module";
import {
  buildIssuedCertificateVariableValues,
  extractCapabilityTags,
  extractLearningHoursFromProgramConfig,
} from "@/lib/server/certificate-variables";
import {
  canRegenerateCertificateStatus,
  getCertificateStatusAfterRegeneration,
} from "@/lib/server/certificates";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const issue = await prisma.certificateIssue.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true } },
      definition: { include: { category: true, template: true } },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  if (!canRegenerateCertificateStatus(issue.status)) {
    return NextResponse.json({ error: "Revoked certificates cannot be regenerated." }, { status: 409 });
  }

  const certificateNumber = issue.verificationCode ?? issue.id;
  const verificationUrl = new URL(`/verify/certificate/${encodeURIComponent(certificateNumber)}`, request.url).toString();
  const renderConfig = parseCertificateRenderConfig(issue.definition.template.renderConfigJson);

  let source: Parameters<typeof buildIssuedCertificateVariableValues>[0]["source"] | undefined;
  if (issue.sourceType === "LEARNING_EXPERIENCE" && issue.sourceId) {
    const participation = await prisma.learningExperienceParticipation.findUnique({
      where: { id: issue.sourceId },
      include: {
        program: {
          select: {
            title: true,
            titleEn: true,
            location: true,
            locationEn: true,
            programConfigJson: true,
            eventLinks: {
              orderBy: { order: "asc" },
              take: 1,
              select: {
                event: {
                  select: {
                    title: true,
                    titleEn: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (participation) {
      const primaryEvent = participation.program.eventLinks[0]?.event;
      const learningHours = extractLearningHoursFromProgramConfig(participation.program.programConfigJson);
      const capabilityTags = extractCapabilityTags(
        participation.program.programConfigJson,
        participation.mentorReviewJson,
      );

      source = {
        programName: participation.program.title,
        programNameEn: participation.program.titleEn,
        courseName: participation.program.title,
        courseNameEn: participation.program.titleEn,
        projectName: participation.program.title,
        projectNameEn: participation.program.titleEn,
        eventName: primaryEvent?.title,
        eventNameEn: primaryEvent?.titleEn,
        locationName: participation.program.location,
        locationNameEn: participation.program.locationEn,
        roleName: participation.status,
        roleNameEn: participation.status,
        completionDate: participation.completedAt,
        learningHours,
        capabilityTags,
      };
    }
  }

  const variableValues = buildIssuedCertificateVariableValues({
    holderName: issue.user.name,
    certificateName: issue.definition.nameEn ?? issue.definition.name,
    certificateNameZh: issue.definition.name,
    certificateNameEn: issue.definition.nameEn,
    categoryName: issue.definition.category.nameEn ?? issue.definition.category.name,
    categoryNameZh: issue.definition.category.name,
    categoryNameEn: issue.definition.category.nameEn,
    issueDate: issue.issuedAt ?? issue.createdAt,
    certificateNumber,
    verificationUrl,
    issuerName: renderConfig.issuerName,
    signer: admin.name,
    source,
  });
  const artifact = await buildCertificateArtifactWithQr({
    holderName: issue.user.name,
    certificateName: issue.definition.nameEn ?? issue.definition.name,
    categoryName: issue.definition.category.nameEn ?? issue.definition.category.name,
    issueDate: issue.issuedAt ?? issue.createdAt,
    certificateNumber,
    verificationUrl,
    renderConfigJson: issue.definition.template.renderConfigJson,
    variableValues,
  });

  await prisma.certificateIssue.update({
    where: { id: issue.id },
    data: {
      generatedFileName: artifact.fileName,
      generatedFileUrl: artifact.dataUrl,
      status: getCertificateStatusAfterRegeneration(issue.status),
    },
  });

  await writeCoreAuditLog({
    actorUserId: admin.id,
    action: "certificate.regenerate",
    subjectType: "certificate_issue",
    subjectId: issue.id,
    result: "generated",
    metadataJson: { fileName: artifact.fileName, pdfFileName: artifact.pdfFileName, mimeType: artifact.mimeType },
    ...getRequestAuditContext(request),
  });

  return NextResponse.json({ ok: true, fileName: artifact.fileName });
}
