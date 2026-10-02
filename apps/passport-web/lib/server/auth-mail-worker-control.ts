import { createHash, timingSafeEqual } from "node:crypto";

export const AUTH_MAIL_WORKER_MAX_BATCH = 10;

/** Compare fixed-size digests; the dedicated worker secret is never accepted in URLs or cookies. */
export function isAuthMailWorkerAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || secret.length > 512 || /\s/.test(secret)) return false;
  const provided = request.headers.get("x-auth-mail-worker-secret");
  if (!provided || provided.length > 512 || new URL(request.url).search) return false;
  return timingSafeEqual(createHash("sha256").update(secret).digest(), createHash("sha256").update(provided).digest());
}

export function authMailBatchLimit(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const fields = payload as Record<string, unknown>;
  if (Object.keys(fields).some(key => key !== "limit")) return null;
  if (fields.limit === undefined) return 1;
  return Number.isInteger(fields.limit) && Number(fields.limit) >= 1 && Number(fields.limit) <= AUTH_MAIL_WORKER_MAX_BATCH
    ? Number(fields.limit) : null;
}
