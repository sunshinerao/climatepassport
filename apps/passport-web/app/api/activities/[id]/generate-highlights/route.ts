import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { tryGenerateHighlightsAfterSave } from "@/lib/server/activity-highlights";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    select: { id: true, type: true, organizerUserId: true },
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  if (activity.type !== "EVENT") {
    return NextResponse.json({ error: "Highlights only available for EVENT type" }, { status: 400 });
  }

  const canManage =
    auth.role === "ADMIN" ||
    (auth.role === "EVENT_MANAGER" && activity.organizerUserId === auth.id);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await tryGenerateHighlightsAfterSave(params.id);

    const updated = await prisma.activity.findUnique({
      where: { id: params.id },
      select: { highlights: true, highlightsEn: true },
    });

    return NextResponse.json({
      ok: true,
      highlights: updated?.highlights ?? null,
      highlightsEn: updated?.highlightsEn ?? null,
    });
  } catch (error) {
    console.error("Generate highlights error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate highlights",
      },
      { status: 500 }
    );
  }
}
