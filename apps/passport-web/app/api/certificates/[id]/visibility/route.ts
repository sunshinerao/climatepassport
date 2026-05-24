import { NextResponse } from "next/server";
import { z } from "zod";
import { writeCoreAuditLog, getRequestAuditContext } from "@/lib/server/audit";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { canMakeCertificatePublicStatus } from "@/lib/server/certificates";
import { getPrismaClient } from "@/lib/server/prisma";

const visibilitySchema = z.object({
  publicVisible: z.boolean(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/certificates");
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
    select: { id: true, userId: true, status: true },
  });

  if (!issue) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
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

  await writeCoreAuditLog({
    actorUserId: user.id,
    action: "certificate.visibility.update",
    subjectType: "certificate_issue",
    subjectId: issue.id,
    result: updated.publicVisible ? "public" : "private",
    metadataJson: { publicVisible: updated.publicVisible },
    ...getRequestAuditContext(request),
  });

  return NextResponse.json({ ok: true, certificate: updated });
}
