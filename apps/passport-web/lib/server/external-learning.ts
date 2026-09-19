import { createHash, timingSafeEqual } from "node:crypto";

export const MAX_EXTERNAL_LEARNING_BODY_BYTES = 64 * 1024;
export const WEBHOOK_MAX_AGE_SECONDS = 300;
const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "x-api-key", "x-signature", "signature"]);
export const sha256Reference = (value: string) => createHash("sha256").update(value).digest("hex");
export function verifyExternalLearningSignature(rawBody: Buffer, secret: string, supplied: string) {
  const expected = createHash("sha256").update(secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex"); const b = Buffer.from(supplied.replace(/^sha256=/i, ""), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export function redactExternalLearningHeaders(headers: Headers, allowed: string[]) {
  const result: Record<string, string> = {};
  for (const name of allowed) { const normalized = name.toLowerCase(); const value = headers.get(normalized); if (value && !SENSITIVE_HEADERS.has(normalized)) result[normalized] = value.slice(0, 512); }
  return result;
}
export function resolveExternalLearningSecret(secretRef: string | null) {
  // Production must resolve this opaque reference through an injected secret manager.
  if (process.env.NODE_ENV !== "production" && secretRef === "local:EXTERNAL_LEARNING_WEBHOOK_SECRET") return process.env.EXTERNAL_LEARNING_WEBHOOK_SECRET ?? null;
  return null;
}
