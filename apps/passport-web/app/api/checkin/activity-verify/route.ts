import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/checkin/activity-verify
 * Compatibility endpoint. All Activity QR scans are handled by the canonical
 * verifier endpoint so authorization, eligibility and idempotency cannot drift.
 */
export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL("/api/verifier/scan", req.url), 307);
}
