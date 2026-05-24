import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { normalizeUserEmail } from "@/lib/server/auth";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(getRequestRateLimitKey(request, "summer-school-passport-id"), {
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ climatePassportId: null, error: "Too many lookup requests." }, { status: 429 });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ climatePassportId: null }, { status: 200 });
  }

  const url = new URL(request.url);
  const emailRaw = url.searchParams.get("email") ?? "";
  const email = normalizeUserEmail(emailRaw);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ climatePassportId: null }, { status: 200 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { climatePassportId: true },
  });

  return NextResponse.json({ climatePassportId: user?.climatePassportId ?? null }, { status: 200 });
}
