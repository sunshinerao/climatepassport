import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { issueQrToken } from "@/lib/server/qr";

export async function POST() {
  const user = await requireAuthenticatedUser("en", "/en/dashboard/climate-passport");

  const qr = await issueQrToken({
    type: "IDENTITY",
    userId: user.id,
    subjectType: "user",
    subjectId: user.id,
    metadataJson: {
      climatePassportId: user.climatePassportId,
    },
  });

  return NextResponse.json({
    ok: true,
    qr: {
      token: qr.token,
      type: qr.type,
      expiresAt: qr.expiresAt?.toISOString() ?? null,
    },
  });
}
