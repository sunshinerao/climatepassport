import { NextRequest } from "next/server";
import { handleOutcomeRequest } from "@/lib/server/app-outcome-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) { return handleOutcomeRequest(req, false); }
