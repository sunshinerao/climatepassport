import { createHash, createHmac, timingSafeEqual } from "crypto";

export const MAX_EMAIL_CODE_ATTEMPTS = 5;
export function hashEmailToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function hashEmailCode(code: string, context: { userId: string; email: string; purpose: string; tokenHash: string; credentialVersion?: string }) {
  const secret = process.env.AUTH_EMAIL_CODE_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_EMAIL_CODE_SECRET must be configured with at least 32 characters.");
  return createHmac("sha256", secret).update(JSON.stringify([context.userId, context.email, context.purpose, context.tokenHash, context.credentialVersion, code])).digest("hex");
}
export function matchesEmailCode(stored: string | null, computed: string) {
  if (!stored || !/^[a-f0-9]{64}$/.test(stored)) return false;
  return timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(computed, "hex"));
}
export function getAuthPublicOrigin() {
  const configured = process.env.AUTH_PUBLIC_ORIGIN;
  if (!configured) throw new Error("AUTH_PUBLIC_ORIGIN must be configured.");
  const url = new URL(configured);
  const localHttp = process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("AUTH_PUBLIC_ORIGIN must be a trusted HTTPS origin.");
  return url.origin;
}

/** Explicit revocation epoch shared by every issuer, confirmer and worker. */
export function getAuthCredentialVersion() {
  const version = process.env.AUTH_EMAIL_CREDENTIAL_VERSION;
  if (!version || version === "legacy" || !/^[A-Za-z0-9_-]{1,64}$/.test(version)) throw new Error("AUTH_EMAIL_CREDENTIAL_VERSION must be configured.");
  return version;
}
