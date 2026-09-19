import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { derivePortfolio } from "@/lib/server/portfolio";

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/portfolio");
  const locale = new URL(request.url).searchParams.get("locale") === "zh" ? "zh" : "en";
  return NextResponse.json(await derivePortfolio(user.id, locale));
}
