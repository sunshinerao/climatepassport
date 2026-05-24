import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getIdentityQrExpiry, issueQrToken } from "@/lib/server/qr";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const qr = await issueQrToken({
    type: "IDENTITY",
    userId: user.id,
    subjectType: "user",
    subjectId: user.id,
    expiresAt: getIdentityQrExpiry(),
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
