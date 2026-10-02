import { NextResponse } from "next/server";
import { derivePortfolio } from "@/lib/server/portfolio";
import { requireApiUser } from "@/lib/server/api-auth";

export async function GET(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof NextResponse) return user;
  const locale = new URL(request.url).searchParams.get("locale") === "zh" ? "zh" : "en";
  return NextResponse.json(await derivePortfolio(user.id, locale));
}
