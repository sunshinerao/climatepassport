import { NextResponse } from "next/server";
import { getRequestAuditContext } from "@/lib/server/audit";
import { getCurrentUser } from "@/lib/server/auth";
import { canRestoreCertificateStatus } from "@/lib/server/certificates";
import { getPrismaClient } from "@/lib/server/prisma";
import { CERTIFICATE_LIFECYCLE_DISPATCH_SCOPE, enqueueOutboundDispatch, findDispatchTargets } from "@/lib/server/reliable-dispatch";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const issue = await prisma.certificateIssue.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  if (!canRestoreCertificateStatus(issue.status)) {
    return NextResponse.json({ error: "Only revoked certificates can be restored." }, { status: 409 });
  }

  const restoredAt = new Date();
  const dispatchTargets = await findDispatchTargets(prisma, CERTIFICATE_LIFECYCLE_DISPATCH_SCOPE);
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.certificateIssue.updateMany({
        where: { id: issue.id, status: "REVOKED" },
        data: { status: "ISSUED", restoredAt, restoredByUserId: admin.id },
      });
      if (updated.count !== 1) throw new CertificateStatusConflict();
      await tx.coreAuditLog.create({
        data: {
          actorUserId: admin.id,
          action: "certificate.restore",
          subjectType: "certificate_issue",
          subjectId: issue.id,
          result: "restored",
          metadataJson: { previousStatus: issue.status, restoredAt: restoredAt.toISOString() },
          ...getRequestAuditContext(request),
        },
      });
      for (const target of dispatchTargets) {
        const enqueued = await enqueueOutboundDispatch(tx, {
          eventType: "certificate.restored",
          idempotencyKey: `certificate:${issue.id}:restored:${restoredAt.toISOString()}:${target.id}`,
          payload: { certificateIssueId: issue.id, status: "ISSUED", occurredAt: restoredAt.toISOString() },
          channelClientId: target.id,
        });
        if (!enqueued.ok) console.error("[dispatch] restore enqueue skipped:", enqueued.error);
      }
    });
  } catch (error) {
    if (error instanceof CertificateStatusConflict) {
      return NextResponse.json({ error: "Certificate status changed. Refresh and try again." }, { status: 409 });
    }
    console.error("certificate restore failed:", error);
    return NextResponse.json({ error: "Restore failed. No state was changed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

class CertificateStatusConflict extends Error {}
