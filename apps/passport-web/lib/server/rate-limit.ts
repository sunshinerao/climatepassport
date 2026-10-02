import { createHash } from "node:crypto";

type RateLimitBucket = { count: number; resetAt: number };
export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number; unavailable?: boolean };

declare global { var __climatePassportRateLimits__: Map<string, RateLimitBucket> | undefined; var __climatePassportRateLimitWarning__: boolean | undefined; }

function getBuckets() { return (globalThis.__climatePassportRateLimits__ ??= new Map()); }
function local(key: string, options: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now(); const buckets = getBuckets(); const current = buckets.get(key);
  if (!current || current.resetAt <= now) { const resetAt = now + options.windowMs; buckets.set(key, { count: 1, resetAt }); return { allowed: true, remaining: Math.max(0, options.limit - 1), resetAt }; }
  if (current.count >= options.limit) return { allowed: false, remaining: 0, resetAt: current.resetAt };
  current.count += 1; return { allowed: true, remaining: Math.max(0, options.limit - current.count), resetAt: current.resetAt };
}

// Kept synchronous for existing non-critical callers.
export function checkRateLimit(key: string, options: { limit: number; windowMs: number }) { return local(key, options); }

/** A deterministic, truncated SHA-256 reference for limiter partitioning; never put raw subjects in limiter keys. */
export function getRateLimitSubjectReference(value: string) {
  return `subject-${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}
/** Normalize a header-supplied address, rejecting anything that is not IP-shaped. Exported so source allowlists share this parsing. */
export function normalizedIp(value: string | null) { const ip = value?.trim().slice(0, 64); return ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip.toLowerCase() : null; }
export function getRequestRateLimitKey(request: Request, scope: string) {
  const trusted = process.env.RATE_LIMIT_TRUST_PROXY === "true";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((value) => normalizedIp(value)).find(Boolean);
  const ip = trusted ? forwarded ?? normalizedIp(request.headers.get("x-real-ip")) : null;
  const source = ip ? getRateLimitSubjectReference(`ip:${ip}`) : "source-unattributed";
  return `${scope}:${source}`;
}
export function getRateLimitRetryAfter(result: RateLimitResult, now = Date.now()) {
  return Math.max(1, Math.ceil((result.resetAt - now) / 1000));
}
export function getRateLimitHeaders(result: RateLimitResult) { return { "Retry-After": String(getRateLimitRetryAfter(result)) }; }
function sharedConfigured() { return Boolean(process.env.RATE_LIMIT_REST_URL && process.env.RATE_LIMIT_REST_TOKEN); }
function configuredMode() { const mode = process.env.RATE_LIMIT_MODE; return mode === "local" || mode === "shared" || mode === "auto" ? mode : "auto"; }
function warnLocal() { if (!globalThis.__climatePassportRateLimitWarning__) { globalThis.__climatePassportRateLimitWarning__ = true; console.warn("[rate-limit] distributed protection is unavailable; using local fallback"); } }
async function shared(key: string, options: { limit: number; windowMs: number }): Promise<RateLimitResult> {
  const base = process.env.RATE_LIMIT_REST_URL!; const token = process.env.RATE_LIMIT_REST_TOKEN!;
  const configuredTimeout = Number.parseInt(process.env.RATE_LIMIT_REST_TIMEOUT_MS ?? "2000", 10);
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(10_000, Math.max(250, configuredTimeout)) : 2000;
  const script = "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end;return {n,redis.call('PTTL',KEYS[1])}";
  const response = await fetch(`${base.replace(/\/$/, "")}/eval`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify([script, 1, key, String(options.windowMs)]), signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error("rate limit backend unavailable");
  const body = await response.json() as { result?: [number, number] }; const result = body.result;
  if (!result || typeof result[0] !== "number") throw new Error("invalid rate limit backend response");
  return { allowed: result[0] <= options.limit, remaining: Math.max(0, options.limit - result[0]), resetAt: Date.now() + Math.max(0, result[1]) };
}
/** Async distributed limiter. sensitive=true fails closed in production when shared protection cannot be used. */
export async function checkRateLimitAsync(key: string, options: { limit: number; windowMs: number; sensitive?: boolean }): Promise<RateLimitResult> {
  const mode = configuredMode(); const production = process.env.NODE_ENV === "production";
  if (mode === "local") { if (production) warnLocal(); return local(key, options); }
  if (!sharedConfigured()) {
    if (production && options.sensitive) return { allowed: false, remaining: 0, resetAt: Date.now(), unavailable: true };
    warnLocal(); return local(key, options);
  }
  try { return await shared(key, options); } catch {
    if (production && options.sensitive) return { allowed: false, remaining: 0, resetAt: Date.now(), unavailable: true };
    warnLocal(); return local(key, options);
  }
}
