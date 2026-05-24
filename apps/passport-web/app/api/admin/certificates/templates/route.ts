import { NextResponse } from "next/server";
import {
  buildCertificateDefinitionWriteData,
  buildCertificateTemplateConfig,
  buildCertificateTemplateRenderConfig,
  buildCertificateTemplateWriteData,
  certificateTemplatePayloadSchema,
} from "@/lib/server/admin-certificates";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const payload = certificateTemplatePayloadSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid template payload." },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const category = await prisma.certificateCategory.findUnique({
    where: { id: payload.data.categoryId },
    select: { id: true },
  });

  if (!category) {
    return NextResponse.json({ error: "Certificate category was not found." }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const template = payload.data.id
      ? await tx.certificateTemplate.update({
          where: { id: payload.data.id },
          data: {
            categoryId: payload.data.categoryId,
            name: payload.data.name,
            nameEn: payload.data.nameEn,
            templateType: payload.data.templateType,
            templateConfigJson: buildCertificateTemplateConfig(payload.data),
            renderConfigJson: buildCertificateTemplateRenderConfig(payload.data),
            isActive: payload.data.isActive,
            version: { increment: 1 },
          },
        })
      : await tx.certificateTemplate.create({
          data: buildCertificateTemplateWriteData(payload.data),
        });

    const existingDefinition = await tx.certificateDefinition.findFirst({
      where: { templateId: template.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    const definitionData = buildCertificateDefinitionWriteData(payload.data, template.id);
    const definition = existingDefinition
      ? await tx.certificateDefinition.update({
          where: { id: existingDefinition.id },
          data: {
            categoryId: definitionData.categoryId,
            name: definitionData.name,
            nameEn: definitionData.nameEn,
            issueRule: definitionData.issueRule,
            approvalMode: definitionData.approvalMode,
            verificationMode: definitionData.verificationMode,
            isActive: definitionData.isActive,
          },
        })
      : await tx.certificateDefinition.create({
          data: definitionData,
        });

    return { template, definition };
  });

  await writeCoreAuditLog({
    actorUserId: admin.id,
    action: payload.data.id ? "certificate.template.update" : "certificate.template.create",
    subjectType: "certificate_template",
    subjectId: result.template.id,
    result: "saved",
    metadataJson: {
      categoryId: result.template.categoryId,
      definitionId: result.definition.id,
      version: result.template.version,
      hasBackground: Boolean(payload.data.backgroundImageUrl),
      hasSeal: Boolean(payload.data.sealImageUrl),
      elementCount: payload.data.elements?.length ?? 0,
    },
    ...getRequestAuditContext(request),
  });

  return NextResponse.json({ ok: true, ...result });
}
