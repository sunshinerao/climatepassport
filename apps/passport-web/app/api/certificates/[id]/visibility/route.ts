import { changeGovernanceVisibility } from "@/lib/server/governance-credentials";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeCoreAuditLog, getRequestAuditContext } from "@/lib/server/audit";
import { canMakeCertificatePublicStatus } from "@/lib/server/certificates";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiUser } from "@/lib/server/api-auth";

const visibilitySchema = z.object({
  publicVisible: z.boolean(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireApiUser(request);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = visibilitySchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const issue = await prisma.certificateIssue.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, status: true, sourceType: true },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  if (issue.sourceType === "GOVERNANCE_REWARD") {
    if (issue.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const grant = await prisma.governanceRewardGrant.findUnique({ where: { certificateIssueId: issue.id }, select: { id: true } });
    if (!grant) return NextResponse.json({ error: "Governance reward unavailable." }, { status: 409 });
    try {
      const result = await prisma.$transaction(tx => changeGovernanceVisibility(tx, user.id, grant.id, payload.data.publicVisible));
      return NextResponse.json({ ok: true, certificate: { id: issue.id, publicVisible: result.publicVisible } });
    } catch {
      return NextResponse.json({ error: "Certificate is not currently eligible for public display." }, { status: 409 });
    }
  }

  if (issue.userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canMakeCertificatePublicStatus(issue.status) && payload.data.publicVisible) {
    return NextResponse.json({ error: "Only issued certificates can be public." }, { status: 409 });
  }

  const updated = await prisma.certificateIssue.update({
    where: { id: issue.id },
    data: { publicVisible: payload.data.publicVisible },
    select: { id: true, publicVisible: true },
  });

  void writeCoreAuditLog({
    actorUserId: user.id,
    action: "certificate.visibility.update",
    subjectType: "certificate_issue",
    subjectId: issue.id,
    result: updated.publicVisible ? "public" : "private",
    metadataJson: { publicVisible: updated.publicVisible },
    ...getRequestAuditContext(request),
  }).catch(() => console.error("certificate audit write failed", { action: "visibility", certificateIssueId: issue.id }));

  return NextResponse.json({ ok: true, certificate: updated });
}
