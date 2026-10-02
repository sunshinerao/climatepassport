import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { requireApiUser } from "@/lib/server/api-auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireApiUser(req);
    if (user instanceof NextResponse) return user;
    const prisma = getPrismaClient();
    if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

    const existing = await prisma.activityWishlist.findUnique({
      where: {
        userId_activityId: {
          userId: user.id,
          activityId: params.id,
        },
      },
    });

    if (existing) {
      await prisma.activityWishlist.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ ok: true, wishlisted: false });
    }

    await prisma.activityWishlist.create({
      data: {
        userId: user.id,
        activityId: params.id,
      },
    });

    return NextResponse.json({ ok: true, wishlisted: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
