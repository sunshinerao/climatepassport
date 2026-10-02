import { NextResponse } from "next/server";
import { isAuthMailWorkerAuthorized, authMailBatchLimit } from "@/lib/server/auth-mail-worker-control";
import { processAuthMailBatch } from "@/lib/server/auth-mail-outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Opt-in invocation only: no GET handler, startup hook, public scheduler or provider fallback. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!isAuthMailWorkerAuthorized(request, process.env.AUTH_MAIL_WORKER_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "JSON required." }, { status: 415, headers });
  }
  // Body contains only a small batch limit. Do not accept addresses, templates, tokens or arbitrary mail.
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > 256)) {
    return NextResponse.json({ error: "Invalid batch request." }, { status: 400, headers });
  }
  let payload: unknown = null;
  const reader = request.body?.getReader();
  if (reader) {
    try {
      let text = "";
      let bytes = 0;
      const decoder = new TextDecoder();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 256) { await reader.cancel(); break; }
        text += decoder.decode(chunk.value, { stream: true });
      }
      if (bytes <= 256) payload = JSON.parse(text + decoder.decode());
    } catch { payload = null; }
    finally { reader.releaseLock(); }
  }
  const limit = authMailBatchLimit(payload);
  if (limit === null) return NextResponse.json({ error: "Invalid batch request." }, { status: 400, headers });
  try {
    await processAuthMailBatch(limit);
    // Job/account/provider details stay server-side. A completed batch is not proof of delivery.
    return NextResponse.json({ ok: true, message: "Batch processed; delivery is not confirmed." }, { headers });
  } catch {
    return NextResponse.json({ error: "Worker unavailable." }, { status: 503, headers });
  }
}
