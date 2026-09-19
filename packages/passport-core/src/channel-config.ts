export const CHANNEL_SHCW = "SHCW" as const;
export const DEFAULT_CHANNEL_TARGET_PATH_PREFIXES = ["/en", "/zh", "/fr", "/de"] as const;

export type ChannelConfig = { channel: typeof CHANNEL_SHCW; enabled: boolean; targetPathPrefixes: readonly string[]; malformed: boolean };
type Environment = Record<string, string | undefined>;

function isLocalePrefix(value: string) {
  return /^\/(en|zh|fr|de)$/.test(value);
}

/** Pure, fail-closed configuration resolver for versioned channel APIs. */
export function resolveChannelConfig(channel: typeof CHANNEL_SHCW, env: Environment = process.env): ChannelConfig {
  const enabledValue = env.CHANNEL_SHCW_ENABLED;
  const prefixesValue = env.CHANNEL_SHCW_TARGET_PATH_PREFIXES;
  const enabledMalformed = enabledValue !== undefined && enabledValue !== "true" && enabledValue !== "false";
  const prefixes = prefixesValue === undefined
    ? [...DEFAULT_CHANNEL_TARGET_PATH_PREFIXES]
    : prefixesValue.split(",").map((value) => value.trim());
  const prefixesMalformed = prefixes.length === 0 || prefixes.some((prefix) => !isLocalePrefix(prefix));
  return {
    channel,
    enabled: !enabledMalformed && !prefixesMalformed && enabledValue === "true",
    targetPathPrefixes: prefixesMalformed ? [] : prefixes,
    malformed: enabledMalformed || prefixesMalformed,
  };
}
