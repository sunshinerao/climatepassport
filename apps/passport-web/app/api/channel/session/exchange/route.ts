import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeChannelBridgeToken, getDashboardPathForRole } from "@/lib/server/auth";
import { locales } from "@/lib/site-content";

const exchangeSchema = z.object({
  token: z.string().min(1),
  locale: z.enum(locales).default("en"),
});

export async function POST(request: Request) {
  const payload = exchangeSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const exchanged = await exchangeChannelBridgeToken(payload.data.token);

  if (!exchanged) {
    return NextResponse.json({ error: "Invalid or expired bridge token." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    redirectTo:
      exchanged.targetPath || getDashboardPathForRole(payload.data.locale, exchanged.role),
  });
}
