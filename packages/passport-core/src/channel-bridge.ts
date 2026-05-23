export const DEFAULT_CHANNEL_BRIDGE_TARGET_PREFIXES = ["/en", "/zh", "/fr", "/de"] as const;

export function sanitizeChannelBridgeTargetPath(
  targetPath: string | null | undefined,
  allowedPrefixes: readonly string[] = DEFAULT_CHANNEL_BRIDGE_TARGET_PREFIXES,
) {
  if (!targetPath) {
    return null;
  }

  const candidate = targetPath.trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(candidate, "https://climatepass.local");
  } catch {
    return null;
  }

  if (parsed.origin !== "https://climatepass.local") {
    return null;
  }

  const allowed = allowedPrefixes.some(
    (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
  );

  if (!allowed) {
    return null;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
