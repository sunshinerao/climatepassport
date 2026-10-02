import { NextRequest, NextResponse } from "next/server";
import { AppOutcomeEventSchema } from "@climate-passport/passport-contracts";
import { requireOpenApiKey, openApiDomainError, openApiInvalidRequest, openApiOk, openApiRequestId } from "@/lib/server/open-api-auth";
import { AppOutcomeFailure, ingestAppOutcome, reconcileAppOutcome } from "@/lib/server/app-outcomes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function handleOutcomeRequest(req: NextRequest, reconcile: boolean) {
  const requestId = openApiRequestId();
  if (req.headers.has("origin") || req.headers.has("cookie")) return openApiDomainError(requestId, { code: "OUTCOME_SOURCE_DENIED", status: 403, error: "Server machine transport required." });
  const gate = await requireOpenApiKey(req, { scope: reconcile ? "channel:outcomes:reconcile" : "channel:outcomes:write" });
  if (!gate.ok) return gate.response;
  const limit = 65536;
  if (Number(req.headers.get("content-length")) > limit) return openApiDomainError(gate.requestId, { code: "INVALID_REQUEST", status: 413, error: "Envelope exceeds 64KiB." });
  const reader = req.body?.getReader();
  if (!reader) return openApiInvalidRequest(gate.requestId, "Envelope required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return openApiDomainError(gate.requestId, { code: "INVALID_REQUEST", status: 413, error: "Envelope exceeds 64KiB." }); }
      chunks.push(value);
    }
    const parsed = AppOutcomeEventSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) return openApiInvalidRequest(gate.requestId, "Invalid app-outcome/1 envelope.");
    const result = await (reconcile ? reconcileAppOutcome : ingestAppOutcome)(gate.prisma, gate.client.id, parsed.data);
    const response = openApiOk(gate, result, result.applied ? 200 : result.state === "blocked" ? 409 : 202);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return openApiInvalidRequest(gate.requestId, "Invalid JSON.");
    if (error instanceof AppOutcomeFailure) return openApiDomainError(gate.requestId, { code: error.code, status: error.status, error: error.message });
    // Never log raw envelope, credentials or private evidence.
    return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Outcome service unavailable.", requestId: gate.requestId } }, { status: 503, headers: { "x-request-id": gate.requestId, "Cache-Control": "no-store" } });
  } finally { reader.releaseLock(); }
}

