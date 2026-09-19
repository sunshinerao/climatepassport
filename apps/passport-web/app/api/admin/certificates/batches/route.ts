import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import {
  createCertificateBatch,
  listCertificateBatches,
  type CertificateBatchSourceValue,
} from "@/lib/server/certificate-batch-issuance";
import { getPrismaClient } from "@/lib/server/prisma";

const createSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(120),
  templateId: z.string().uuid(),
  source: z.enum(["MANUAL_LIST", "CSV", "ACTIVITY_ELIGIBLE_LIST"]),
  recipients: z.string().max(200 * 320).optional(),
  activityId: z.string().uuid().nullish(),
  issueDate: z.string().trim().max(40).optional(),
  variableValues: z.record(z.string(), z.unknown()).optional(),
  notify: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.source === "ACTIVITY_ELIGIBLE_LIST" && !value.activityId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["activityId"],
      message: "An activity must be selected for the eligible-list source.",
    });
  }
});

export async function GET(request: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10);
  const result = await listCertificateBatches(prisma, Number.isNaN(limit) ? 10 : limit);

  return NextResponse.json({ ok: true, batches: result.batches });
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as unknown;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = createSchema.safeParse(body);
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

  const result = await createCertificateBatch(prisma, {
    idempotencyKey: payload.data.idempotencyKey,
    source: payload.data.source as CertificateBatchSourceValue,
    templateId: payload.data.templateId,
    recipients: payload.data.recipients,
    activityId: payload.data.activityId ?? undefined,
    issueDate: payload.data.issueDate,
    variableValues: payload.data.variableValues,
    notify: payload.data.notify,
    createdByUserId: admin.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ok: true, replayed: result.replayed, batch: result.batch, items: result.items },
    { status: result.status },
  );
}
