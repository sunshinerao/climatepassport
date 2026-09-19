import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { preflightCertificateBatch } from "@/lib/server/certificate-batch-issuance";
import { getPrismaClient } from "@/lib/server/prisma";

const preflightSchema = z.object({
  templateId: z.string().uuid(),
  source: z.enum(["MANUAL_LIST", "CSV", "ACTIVITY_ELIGIBLE_LIST"]),
  recipients: z.string().trim().max(200 * 320).optional(),
  activityId: z.string().uuid().nullish(),
}).superRefine((value, context) => {
  if (value.source === "ACTIVITY_ELIGIBLE_LIST" && !value.activityId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["activityId"],
      message: "An activity must be selected for the eligible-list source.",
    });
  }
  if ((value.source === "MANUAL_LIST" || value.source === "CSV") && !value.recipients?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recipients"],
      message: "Recipient list is required for this source.",
    });
  }
});

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as unknown;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = preflightSchema.safeParse(body);
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

  const report = await preflightCertificateBatch(prisma, {
    templateId: payload.data.templateId,
    source: payload.data.source,
    recipients: payload.data.recipients,
    activityId: payload.data.activityId ?? undefined,
  });

  if (!report.ok) {
    return NextResponse.json({ error: report.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, report });
}
