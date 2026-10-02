import { NextResponse, type NextRequest } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { syncParticipationToPassport } from "@/lib/server/activity-rewards";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { requireApiUser } from "@/lib/server/api-auth";

/** POST /api/activity-participations/[id]/sync-passport */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApiUser(req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const participation = await prisma.activityParticipation.findUnique({
    where: { id: params.id },
    select: { userId: true, activityId: true, status: true, passportSynced: true },
  });

  if (!participation) {
    return NextResponse.json({ error: "Participation not found" }, { status: 404 });
  }

  const isOwner = participation.userId === user.id;
  const canManage = await canManageActivity(prisma, user, participation.activityId);
  if (!isOwner && !canManage) {
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
