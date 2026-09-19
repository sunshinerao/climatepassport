import { NextRequest, NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { canManageActivity } from "@/lib/server/verifier-activity";

export async function GET(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get("activityId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const objectType = searchParams.get("objectType") ?? undefined;

  if (!activityId) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  if (!(await canManageActivity(prisma, auth, activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const workflows = await prisma.activityReviewWorkflow.findMany({
    where: {
      activityId,
      ...(status ? { status: status as any } : {}),
      ...(objectType ? { objectType: objectType as any } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ workflows });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const body = await req.json();
  const { status, comment, score } = body;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const existing = await prisma.activityReviewWorkflow.findUnique({ where: { id }, select: { activityId: true } });
  if (!existing) return NextResponse.json({ error: "Review workflow not found" }, { status: 404 });
  if (!(await canManageActivity(prisma, auth, existing.activityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const workflow = await prisma.activityReviewWorkflow.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(comment !== undefined && { comment }),
      ...(score !== undefined && { score }),
      reviewerUserId: auth.id,
    },
  });

  return NextResponse.json({ workflow });
}
