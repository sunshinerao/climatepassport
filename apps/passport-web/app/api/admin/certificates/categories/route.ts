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
