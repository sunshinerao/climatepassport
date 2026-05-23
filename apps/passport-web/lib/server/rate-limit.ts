type RateLimitBucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __climatePassportRateLimits__: Map<string, RateLimitBucket> | undefined;
}

function getBuckets() {
  if (!globalThis.__climatePassportRateLimits__) {
    globalThis.__climatePassportRateLimits__ = new Map();
  }

  return globalThis.__climatePassportRateLimits__;
}

export function getRequestRateLimitKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.slice(0, 120) ?? "unknown";

  return `${scope}:${forwardedFor || realIp || "unknown"}:${userAgent}`;
}

export function checkRateLimit(
  key: string,
  options: {
    limit: number;
    windowMs: number;
  },
) {
  const now = Date.now();
  const buckets = getBuckets();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { allowed: true, remaining: Math.max(0, options.limit - 1), resetAt: now + options.windowMs };
  }

  if (current.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { allowed: true, remaining: Math.max(0, options.limit - current.count), resetAt: current.resetAt };
}
