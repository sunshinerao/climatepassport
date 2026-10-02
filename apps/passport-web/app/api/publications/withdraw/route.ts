import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { withdrawProjection } from "@/lib/server/publication-gateway";

const withdrawBodySchema = z.object({
  objectType: z.string().trim().min(1).max(64),
  objectId: z.string().trim().min(1).max(128),
  version: z.number().int().min(1),
  programmeId: z.string().uuid().optional(),
}).strict();

/** CP-TODO-251：撤回指定版本的已发布投影（立即生效、不可恢复，已撤回版本不可重发）。 */
export async function POST(req: NextRequest) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = withdrawBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });

  const result = await withdrawProjection(prisma, {
    actorUserId: session.user.id,
    objectType: parsed.data.objectType,
    objectId: parsed.data.objectId,
    version: parsed.data.version,
    programmeId: parsed.data.programmeId ?? null,
  });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ publicationId: result.publicationId });
}
