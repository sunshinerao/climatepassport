import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getCertificateBatchDetail } from "@/lib/server/certificate-batch-issuance";
import { getPrismaClient } from "@/lib/server/prisma";

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const detail = await getCertificateBatchDetail(prisma, params.id);
  if (!detail.batch) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, batch: detail.batch, items: detail.items });
}
