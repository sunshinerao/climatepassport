import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { listPrivateAppOutcomes } from "@/lib/server/app-outcomes";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  try { return NextResponse.json({ outcomes: await listPrivateAppOutcomes(prisma, session.user.id) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Outcome service unavailable." }, { status: 503 }); }
}
