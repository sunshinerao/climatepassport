import { NextResponse, type NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { syncParticipationToPassport } from "@/lib/server/activity-rewards";

/** POST /api/activity-participations/[id]/sync-passport */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuthenticatedUser("en" as any, "/en/dashboard");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const participation = await prisma.activityParticipation.findUnique({
    where: { id: params.id },
    select: { userId: true, status: true, passportSynced: true },
  });

  if (!participation) {
    return NextResponse.json({ error: "Participation not found" }, { status: 404 });
  }

  // Only the participant or an admin can trigger sync
  if (participation.userId !== user.id && !["ADMIN", "EVENT_MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (participation.passportSynced) {
    return NextResponse.json({ ok: true, message: "Already synced" });
  }

  if (!["COMPLETED", "CERTIFIED"].includes(participation.status)) {
    return NextResponse.json({ error: "Participation must be COMPLETED or CERTIFIED to sync" }, { status: 409 });
  }

  await syncParticipationToPassport(params.id);
  return NextResponse.json({ ok: true, message: "Synced to Passport Timeline" });
}
