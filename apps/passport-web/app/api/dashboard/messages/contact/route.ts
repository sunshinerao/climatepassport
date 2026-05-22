import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const contactSchema = z.object({
  category: z
    .enum([
      "GENERAL",
      "ORGANIZATION",
      "PARTNERSHIP",
      "SPEAKER",
      "MEDIA",
      "SPONSOR",
      "VOLUNTEER",
      "OTHER",
    ])
    .default("GENERAL"),
  subject: z.string().trim().min(4).max(160),
  message: z.string().trim().min(10).max(3000),
  organization: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(50).optional(),
});

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/messages");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = contactSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const contactMessage = await prisma.contactMessage.create({
    data: {
      userId: user.id,
      name: user.name,
      email: user.email,
      category: payload.data.category,
      subject: payload.data.subject,
      message: payload.data.message,
      organization: payload.data.organization,
      phone: payload.data.phone,
      status: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, contactMessage });
}
