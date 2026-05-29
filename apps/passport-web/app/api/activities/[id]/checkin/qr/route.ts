import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { issueQrToken } from "@/lib/server/qr";

/** Generate an ACTIVITY_CHECKIN QR token for the authenticated user + given activity */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireAuthenticatedUser("en" as any, "/en/dashboard");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const taskId: string | null = body.taskId ?? null;
  const windowMinutes: number = typeof body.windowMinutes === "number" ? Math.min(body.windowMinutes, 120) : 30;

  // Verify user has an active participation in this activity
  const participation = await prisma.activityParticipation.findUnique({
    where: { activityId_userId: { activityId: params.id, userId: user.id } },
    select: { id: true, status: true },
  });

  if (!participation || ["ARCHIVED", "ABSENT", "FAILED"].includes(participation.status)) {
    return NextResponse.json({ error: "No active participation found for this activity" }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * windowMinutes);

  const qr = await issueQrToken({
    type: "ACTIVITY_CHECKIN",
    userId: user.id,
    activityId: params.id,
    subjectType: "activity_participation",
    subjectId: participation.id,
    expiresAt,
    scopeJson: {
      actions: ["activity_checkin"],
      taskId,
    },
  });

  return NextResponse.json({
    ok: true,
    qr: {
      token: qr.token,
      type: qr.type,
      expiresAt: qr.expiresAt?.toISOString() ?? null,
      activityId: params.id,
      taskId,
    },
  });
}
