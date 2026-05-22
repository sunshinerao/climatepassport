const LOCAL_REDIRECT_FALLBACK = "/";

function hasUnsafeEncodedPrefix(path: string) {
  const lowerPath = path.toLowerCase();
  return lowerPath.startsWith("/%2f") || lowerPath.startsWith("/%5c");
}

export function sanitizeLocalRedirectPath(value: string | null | undefined, fallback = LOCAL_REDIRECT_FALLBACK) {
  if (!value) {
    return fallback;
  }

  const candidate = value.trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    hasUnsafeEncodedPrefix(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "https://climatepass.local");

    if (parsed.origin !== "https://climatepass.local" || hasUnsafeEncodedPrefix(parsed.pathname)) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function optionalLocalRedirectPath(value: string | null | undefined) {
  const sanitized = sanitizeLocalRedirectPath(value, "");
  return sanitized || null;
}
