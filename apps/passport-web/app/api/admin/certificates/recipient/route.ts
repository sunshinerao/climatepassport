import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, normalizeUserEmail } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

const querySchema = z.object({
  email: z.string().trim().email(),
});

export async function GET(request: Request) {
  const admin = await getCurrentUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const parseResult = querySchema.safeParse({
    email: new URL(request.url).searchParams.get("email") ?? "",
  });

  if (!parseResult.success) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizeUserEmail(parseResult.data.email) },
    select: {
      id: true,
      name: true,
      email: true,
      climatePassportId: true,
      status: true,
    },
  });

  if (!user) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  return NextResponse.json({
    found: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      climatePassportId: user.climatePassportId,
      status: user.status,
    },
  });
}