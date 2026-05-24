import { NextResponse } from "next/server";
import {
  buildCertificateCategoryWriteData,
  certificateCategoryPayloadSchema,
} from "@/lib/server/admin-certificates";
import { getCurrentUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function POST(request: Request) {
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

  const writeData = buildCertificateCategoryWriteData(payload.data);
  const category = payload.data.id
    ? await prisma.certificateCategory.update({
        where: { id: payload.data.id },
        data: writeData,
      })
    : await prisma.certificateCategory.create({
        data: writeData,
      });

  return NextResponse.json({ ok: true, category });
}
