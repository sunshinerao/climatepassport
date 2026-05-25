import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  try {
    const admin = await getCurrentUser();

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const payload = certificateTemplatePayloadSchema.safeParse(await request.json());
    if (!payload.success) {
      const firstIssue = payload.error.issues[0];
      const issuePath = firstIssue?.path?.length ? firstIssue.path.join(".") : "";
      const issueMessage = firstIssue?.message?.trim() || "Invalid template payload.";
      return NextResponse.json(
        {
          error: issuePath && issueMessage === "Invalid input"
            ? `Invalid template payload: ${issuePath}`
            : issuePath && issueMessage.startsWith("Invalid input")
              ? `Invalid template payload: ${issuePath} (${issueMessage})`
              : issueMessage,
        },
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Template or definition not found." }, { status: 404 });
      }
      if (error.code === "P2003") {
        return NextResponse.json({ error: "Related category does not exist." }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Failed to save template." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentUser();

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    const templateId = typeof body.id === "string" ? body.id.trim() : "";
    if (!templateId) {
      return NextResponse.json({ error: "Template id is required." }, { status: 400 });
    }

    const prisma = getPrismaClient();
    if (!prisma) {
      return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
    }

    const template = await prisma.certificateTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        categoryId: true,
        definitions: {
          select: {
            id: true,
            _count: {
              select: { issues: true },
            },
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template was not found." }, { status: 404 });
    }

    const issuedCount = template.definitions.reduce((sum, definition) => sum + definition._count.issues, 0);
    if (issuedCount > 0) {
      return NextResponse.json(
        { error: "Template has issued certificates and cannot be deleted." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.certificateDefinition.deleteMany({ where: { templateId: template.id } });
      await tx.certificateTemplate.delete({ where: { id: template.id } });
    });

    await writeCoreAuditLog({
      actorUserId: admin.id,
      action: "certificate.template.delete",
      subjectType: "certificate_template",
      subjectId: template.id,
      result: "deleted",
      metadataJson: {
        categoryId: template.categoryId,
        definitionCount: template.definitions.length,
      },
      ...getRequestAuditContext(request),
    });

    return NextResponse.json({ ok: true, id: template.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Template was not found." }, { status: 404 });
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Template has issued certificates and cannot be deleted." },
          { status: 409 },
        );
      }
    }

    return NextResponse.json({ error: "Failed to delete template." }, { status: 500 });
  }
}
