import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const source = await prisma.certificateTemplate.findUnique({ where: { id: params.id }, include: { category: true, definitions: { orderBy: { createdAt: "asc" }, take: 1 } } });
  if (!source) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  if (!source.category.isActive) return NextResponse.json({ error: "Copies require an active category." }, { status: 409 });
  const copy = await prisma.$transaction(async (tx) => {
    const template = await tx.certificateTemplate.create({ data: { categoryId: source.categoryId, name: `${source.name}（副本）`, nameEn: source.nameEn ? `${source.nameEn} (Copy)` : null, templateType: source.templateType, templateConfigJson: source.templateConfigJson as Prisma.InputJsonValue, renderConfigJson: source.renderConfigJson === null ? Prisma.JsonNull : source.renderConfigJson as Prisma.InputJsonValue, isActive: false, version: 1 } });
    const definition = source.definitions[0] ? await tx.certificateDefinition.create({ data: { categoryId: source.categoryId, templateId: template.id, name: `${source.definitions[0].name}（副本）`, nameEn: source.definitions[0].nameEn ? `${source.definitions[0].nameEn} (Copy)` : null, issueRule: source.definitions[0].issueRule === null ? Prisma.JsonNull : source.definitions[0].issueRule as Prisma.InputJsonValue, approvalMode: source.definitions[0].approvalMode, verificationMode: source.definitions[0].verificationMode, isActive: false } }) : null;
    return { template, definition };
  });
  void writeCoreAuditLog({ actorUserId: admin.id, action: "certificate.template.copy", subjectType: "certificate_template", subjectId: copy.template.id, result: "created", metadataJson: { sourceTemplateId: source.id, categoryId: source.categoryId }, ...getRequestAuditContext(request) });
  return NextResponse.json({ ok: true, ...copy });
}
