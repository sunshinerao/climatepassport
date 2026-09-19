import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  buildCertificateCategoryWriteData,
  certificateCategoryPayloadSchema,
} from "@/lib/server/admin-certificates";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(request: Request) {
  try {
    const admin = await getCurrentUser();

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const payload = certificateCategoryPayloadSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message ?? "Invalid category payload." },
        { status: 400 },
      );
    }

    const prisma = getPrismaClient();
    if (!prisma) {
      return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
    }

    const isUpdate = Boolean(payload.data.id);
    let resolvedOrder = typeof payload.data.order === "number" ? payload.data.order : undefined;
    if (!isUpdate && typeof resolvedOrder !== "number") {
      const maxOrder = await prisma.certificateCategory.aggregate({ _max: { order: true } });
      resolvedOrder = (maxOrder._max.order ?? -1) + 1;
    }

    if (payload.data.id) {
      const existing = await prisma.certificateCategory.findUnique({ where: { id: payload.data.id }, select: { key: true } });
      if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });
      if (existing.key !== payload.data.key) return NextResponse.json({ error: "Category key is immutable." }, { status: 409 });
    }
    const writeData = buildCertificateCategoryWriteData(payload.data, resolvedOrder);
    const category = payload.data.id
      ? await prisma.certificateCategory.update({
          where: { id: payload.data.id },
          data: writeData,
        })
      : await prisma.certificateCategory.create({
          data: writeData,
        });

    return NextResponse.json({ ok: true, category });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Category key already exists." }, { status: 409 });
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }
      if (error.code === "P2022") {
        return NextResponse.json({ error: "Database schema is outdated. Please run category migration." }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Failed to save category." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { id?: string; isActive?: boolean };
  if (!body.id || typeof body.isActive !== "boolean") return NextResponse.json({ error: "Category id and active state are required." }, { status: 400 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  try {
    const category = await prisma.$transaction(async (tx) => {
      if (!body.isActive) {
        const [templates, definitions] = await Promise.all([tx.certificateTemplate.count({ where: { categoryId: body.id, isActive: true } }), tx.certificateDefinition.count({ where: { categoryId: body.id, isActive: true } })]);
        if (templates || definitions) throw new Error(`DEPENDENCIES:${templates}:${definitions}`);
      }
      return tx.certificateCategory.update({ where: { id: body.id! }, data: { isActive: body.isActive } });
    });
    return NextResponse.json({ ok: true, category });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("DEPENDENCIES:")) { const [, templates, definitions] = message.split(":"); return NextResponse.json({ error: "Active templates or definitions must be disabled first.", activeTemplateCount: Number(templates), activeDefinitionCount: Number(definitions) }, { status: 409 }); }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Category not found." }, { status: 404 });
    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "Category id is required." }, { status: 400 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  try {
    await prisma.$transaction(async (tx) => {
      const [templates, definitions] = await Promise.all([tx.certificateTemplate.count({ where: { categoryId: body.id } }), tx.certificateDefinition.count({ where: { categoryId: body.id } })]);
      if (templates || definitions) throw new Error("DEPENDENCIES");
      await tx.certificateCategory.delete({ where: { id: body.id! } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "DEPENDENCIES") return NextResponse.json({ error: "Categories with templates or definitions cannot be deleted." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Category not found." }, { status: 404 });
    return NextResponse.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
