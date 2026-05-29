import { NextResponse, type NextRequest } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

/** GET /api/activities/[id]/detail  — fetch type-specific config */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const detail = await prisma.activityDetail.findUnique({
    where: { activityId: params.id },
  });

  return NextResponse.json({ detail });
}

/** PATCH /api/activities/[id]/detail  — upsert type-specific config (admin/manager only) */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"], "/en/admin");
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { configJson } = body as { configJson?: unknown };

  if (!configJson || typeof configJson !== "object") {
    return NextResponse.json({ error: "configJson is required and must be an object" }, { status: 400 });
  }

  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    select: { type: true },
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const detail = await prisma.activityDetail.upsert({
    where: { activityId: params.id },
    create: {
      activityId: params.id,
      type: activity.type,
      configJson,
    },
    update: {
      configJson,
    },
  });

  return NextResponse.json({ detail });
}
