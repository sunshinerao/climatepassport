import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Admin or the applicant themselves can view
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const application = await prisma.activityApplication.findUnique({
    where: { id: params.id },
    include: {
      activity: { select: { id: true, title: true, slug: true, type: true } },
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ application });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const existing = await prisma.activityApplication.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { action, formResponseJson, reviewComment } = body;

  // "withdraw" action can be performed by the applicant themselves
  if (action === "withdraw") {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Only the applicant or an admin/event_manager can withdraw
    if (existing.userId !== currentUser.id) {
      const adminCheck = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
      if (adminCheck instanceof NextResponse) {
        return NextResponse.json({ error: "Not authorized to withdraw this application" }, { status: 403 });
      }
    }

    if (!["PENDING", "PENDING_REVIEW", "WAITLISTED"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Can only withdraw applications in PENDING, PENDING_REVIEW, or WAITLISTED status" },
        { status: 409 }
      );
    }

    const application = await prisma.activityApplication.update({
      where: { id: params.id },
      data: { status: "WITHDRAWN" },
    });

    return NextResponse.json({ application });
  }

  // Other PATCH operations require admin/event_manager
  const auth = await requireRoleAccess("en" as any, ["ADMIN", "EVENT_MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const application = await prisma.activityApplication.update({
    where: { id: params.id },
    data: {
      ...(formResponseJson !== undefined ? { formResponseJson } : {}),
      ...(reviewComment !== undefined ? { reviewComment } : {}),
    },
  });

  return NextResponse.json({ application });
}
