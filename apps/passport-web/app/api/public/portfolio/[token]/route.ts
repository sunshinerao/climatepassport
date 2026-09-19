import { NextResponse } from "next/server";
import { resolvePublicPortfolioShare } from "@/lib/server/portfolio";

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try { const projection = await resolvePublicPortfolioShare(params.token, "en"); return projection ? NextResponse.json(projection, { headers: { "X-Robots-Tag": "noindex, nofollow" } }) : NextResponse.json({ error: "Not found." }, { status: 404 }); } catch { return NextResponse.json({ error: "Unavailable." }, { status: 503 }); }
}
