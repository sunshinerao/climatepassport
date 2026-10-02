import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PublicationUpsertSchema } from "@climate-passport/passport-contracts";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { publishProjection, readPublishedProjection } from "@/lib/server/publication-gateway";

const readQuerySchema = z.object({
  objectType: z.string().trim().min(1),
  objectId: z.string().trim().min(1),
  version: z.coerce.number().int().min(1).optional(),
});

/** CP-TODO-251：公开读门（fail-closed，只返回 PUBLISHED 且未撤回版本；无需会话）。 */
export async function GET(req: NextRequest) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const searchParams = new URL(req.url).searchParams;
  const parsed = readQuerySchema.safeParse({
    objectType: searchParams.get("objectType"),
    objectId: searchParams.get("objectId"),
    version: searchParams.get("version") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });

  const { publication } = await readPublishedProjection(prisma, {
    objectType: parsed.data.objectType,
    objectId: parsed.data.objectId,
    version: parsed.data.version,
  });
  if (!publication) {
    return NextResponse.json({ error: "Publication not found.", code: "PUBLICATION_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ publication }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

/** CP-TODO-251：发布对象投影版本（须通过发布权限/同意门/可选批准回执门）。 */
export async function POST(req: NextRequest) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = PublicationUpsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });

  const result = await publishProjection(prisma, {
    actorUserId: session.user.id,
    objectType: parsed.data.objectType,
    objectId: parsed.data.objectId,
    version: parsed.data.version,
    projectionJson: parsed.data.projectionJson,
    channel: parsed.data.channel ?? null,
    license: parsed.data.license ?? null,
    programmeId: parsed.data.programmeId ?? null,
    consentRequirements: parsed.data.consentRequirements ?? [],
    approvalReceipt: parsed.data.approvalReceipt ?? false,
  });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  return NextResponse.json({ publicationId: result.publicationId, deduplicated: result.deduplicated }, { status: 201 });
}
