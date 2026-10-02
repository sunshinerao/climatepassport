import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAuditContext } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { canRevokeCertificateStatus } from "@/lib/server/certificates";
import { getPrismaClient } from "@/lib/server/prisma";
import { CERTIFICATE_LIFECYCLE_DISPATCH_SCOPE, enqueueOutboundDispatch, findDispatchTargets } from "@/lib/server/reliable-dispatch";

const revokeSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = revokeSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const issue = await prisma.certificateIssue.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  if (!canRevokeCertificateStatus(issue.status)) {
    return NextResponse.json({ error: "Only issued certificates can be revoked." }, { status: 409 });
  }

  const revokedAt = new Date();
  // CP-TODO-244: select dispatch targets before the transaction; enqueue in the same
  // transaction as the state change so a revoked certificate can never exist without
  // its outbound event (CP-FR-070, withdrawal/cancellation first).
  const dispatchTargets = await findDispatchTargets(prisma, CERTIFICATE_LIFECYCLE_DISPATCH_SCOPE);
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.certificateIssue.updateMany({
        where: { id: issue.id, status: issue.status },
        data: {
          status: "REVOKED",
          revokedAt,
          revokedByUserId: admin.id,
          revocationReason: payload.data.reason,
          restoredAt: null,
          restoredByUserId: null,
        },
      });
      if (updated.count !== 1) throw new CertificateStatusConflict();
      await tx.coreAuditLog.create({
        data: {
          actorUserId: admin.id,
          action: "certificate.revoke",
          subjectType: "certificate_issue",
          subjectId: issue.id,
          result: "revoked",
          metadataJson: { previousStatus: issue.status, reason: payload.data.reason, revokedAt: revokedAt.toISOString() },
          ...getRequestAuditContext(request),
        },
      });
      for (const target of dispatchTargets) {
        const enqueued = await enqueueOutboundDispatch(tx, {
          eventType: "certificate.revoked",
          idempotencyKey: `certificate:${issue.id}:revoked:${revokedAt.toISOString()}:${target.id}`,
          payload: { certificateIssueId: issue.id, status: "REVOKED", reason: payload.data.reason, occurredAt: revokedAt.toISOString() },
          channelClientId: target.id,
        });
        if (!enqueued.ok) console.error("[dispatch] revoke enqueue skipped:", enqueued.error);
      }
    });
  } catch (error) {
    if (error instanceof CertificateStatusConflict) {
      return NextResponse.json({ error: "Certificate status changed. Refresh and try again." }, { status: 409 });
    }
    console.error("certificate revoke failed:", error);
    return NextResponse.json({ error: "Revoke failed. No state was changed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

class CertificateStatusConflict extends Error {}
