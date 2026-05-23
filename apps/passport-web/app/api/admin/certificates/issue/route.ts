import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { allocateCertificateVerificationCode } from "@/lib/server/certificates";
import { renderCertificateHtml } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";

const issueSchema = z.object({
  email: z.string().trim().email(),
  templateId: z.string().uuid(),
});

export async function POST(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const body = await request.json() as unknown;
  const payload = issueSchema.safeParse(body);
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

  const { email, templateId } = payload.data;

  // Find recipient user
  const recipient = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, name: true },
  });
  if (!recipient) {
    return NextResponse.json({ error: "No user found with that email address." }, { status: 404 });
  }

  // Find an active definition for this template
  const definition = await prisma.certificateDefinition.findFirst({
    where: { templateId, isActive: true },
    include: { category: true },
  });
  if (!definition) {
    return NextResponse.json({ error: "No active certificate definition found for this template." }, { status: 404 });
  }

  const verificationCode = await allocateCertificateVerificationCode(async (candidate) => {
    const existing = await prisma.certificateIssue.findUnique({
      where: { verificationCode: candidate },
      select: { id: true },
    });

    return Boolean(existing);
  });

  const issuedAt = new Date();
  const fileName = `${verificationCode}.html`;
  const html = renderCertificateHtml({
    holderName: recipient.name,
    certificateName: definition.nameEn ?? definition.name,
    categoryName: definition.category.nameEn ?? definition.category.name,
    issueDate: issuedAt.toISOString().slice(0, 10),
    certificateNumber: verificationCode,
  });

  await prisma.certificateIssue.create({
    data: {
      definitionId: definition.id,
      userId: recipient.id,
      status: "ISSUED",
      approvedBy: admin.id,
      approvedAt: issuedAt,
      issuedAt,
      verificationCode,
      generatedFileName: fileName,
      generatedFileUrl: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    },
  });

  return NextResponse.json({ ok: true });
}
