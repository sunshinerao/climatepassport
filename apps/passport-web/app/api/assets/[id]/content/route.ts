import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import {
  readControlledAssetContent,
  uploadControlledAssetBytes,
} from "@/lib/server/controlled-assets";

// CP-TODO-248：受控资产字节端点 —— PUT 上传字节（完整性 + 真实类型校验，
// 剥离定位元数据后落盘）；GET 下载字节（须通过扫描门禁，CP-FR-058）。

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const result = await uploadControlledAssetBytes(prisma, {
    assetId: params.id,
    actorUserId: session.user.id,
    bytes: Buffer.from(await req.arrayBuffer()),
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  return NextResponse.json(result, { status: 200 });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const session = await getCurrentSession();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const result = await readControlledAssetContent(prisma, { assetId: params.id, actorUserId: session.user.id });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }
  const asset = result.asset as { contentType: string; fileName: string; sha256: string };
  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      "content-type": asset.contentType,
      "content-disposition": `attachment; filename="${encodeURIComponent(asset.fileName)}"`,
      "x-content-sha256": asset.sha256,
      "cache-control": "private, no-store",
    },
  });
}
