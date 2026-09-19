import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/server/prisma";
import { checkRateLimitAsync, getRequestRateLimitKey, getRateLimitHeaders } from "@/lib/server/rate-limit";
import { MAX_EXTERNAL_LEARNING_BODY_BYTES, redactExternalLearningHeaders, resolveExternalLearningSecret, sha256Reference, verifyExternalLearningSignature, WEBHOOK_MAX_AGE_SECONDS } from "@/lib/server/external-learning";

export async function POST(request: Request, { params }: { params: { providerKey: string } }) {
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 });
  const provider = await prisma.externalLearningProvider.findUnique({ where: { webhookPathKey: params.providerKey }, select: { id: true, status: true, signingSecretRef: true, verificationConfigJson: true } });
  // Deliberately reject DRAFT/DISABLED before reading input or consulting secrets.
  if (!provider || provider.status !== "ACTIVE") return NextResponse.json({ error: { code: "EXTERNAL_LEARNING_PROVIDER_NOT_FOUND" } }, { status: 404 });
  const limit = await checkRateLimitAsync(getRequestRateLimitKey(request, `external-learning:${provider.id}`), { limit: 60, windowMs: 60_000, sensitive: true });
  if (limit.unavailable) return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 });
  if (!limit.allowed) return NextResponse.json({ error: { code: "RATE_LIMITED" } }, { status: 429, headers: getRateLimitHeaders(limit) });
  const config = provider.verificationConfigJson as { algorithm?: string; signatureHeader?: string; timestampHeader?: string; deliveryIdHeader?: string; eventTypeHeader?: string } | null;
  const secret = resolveExternalLearningSecret(provider.signingSecretRef);
  if (!config || config.algorithm !== "HMAC-SHA256" || !config.signatureHeader || !config.timestampHeader || !config.deliveryIdHeader || !config.eventTypeHeader || !secret) return NextResponse.json({ error: { code: "EXTERNAL_LEARNING_WEBHOOK_REJECTED" } }, { status: 404 });
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength > MAX_EXTERNAL_LEARNING_BODY_BYTES) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 413 });
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (rawBody.length > MAX_EXTERNAL_LEARNING_BODY_BYTES) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 413 });
  const timestamp = Number(request.headers.get(config.timestampHeader)); const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(timestamp) || Math.abs(now - timestamp) > WEBHOOK_MAX_AGE_SECONDS) return NextResponse.json({ error: { code: "EXTERNAL_LEARNING_REPLAY_REJECTED" } }, { status: 401 });
  const signature = request.headers.get(config.signatureHeader);
  if (!signature || !verifyExternalLearningSignature(rawBody, secret, signature)) return NextResponse.json({ error: { code: "EXTERNAL_LEARNING_WEBHOOK_REJECTED" } }, { status: 401 });
  const deliveryId = request.headers.get(config.deliveryIdHeader); const eventType = request.headers.get(config.eventTypeHeader);
  if (!deliveryId || deliveryId.length > 256 || !eventType || eventType.length > 128) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400 });
  try {
    await prisma.externalLearningInboxEvent.create({ data: { providerId: provider.id, deliveryId, eventType, signatureStatus: "VERIFIED", processingStatus: "PENDING_RECONCILIATION", payloadSha256: sha256Reference(rawBody.toString("base64")), redactedHeadersJson: redactExternalLearningHeaders(request.headers, [config.timestampHeader, config.deliveryIdHeader, config.eventTypeHeader]) } });
  } catch (error: unknown) {
    if (!(typeof error === "object" && error && "code" in error && error.code === "P2002")) throw error;
  }
  return NextResponse.json({ accepted: true }, { status: 202 });
}
