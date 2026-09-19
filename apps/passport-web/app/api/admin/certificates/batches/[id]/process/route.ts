import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { processCertificateBatchChunk } from "@/lib/server/certificate-batch-issuance";
import { getPrismaClient } from "@/lib/server/prisma";

const processSchema = z.object({
  limit: z.number().int().min(1).max(10).optional(),
});

type RouteContext = { params: { id: string } };

export async function POST(request: Request, { params }: RouteContext) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as unknown;
  const payload = processSchema.safeParse(body ?? {});
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const result = await processCertificateBatchChunk(prisma, {
    batchId: params.id,
    limit: payload.data.limit,
    actorUserId: admin.id,
    verificationUrlBase: new URL(request.url).origin,
  });

  if (!result.ok || !result.batch) {
    return NextResponse.json({ error: result.error ?? "Batch not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, batch: result.batch, processedItems: result.processedItems });
}
