import type { Locale } from "@/lib/site-content";

const fallbackRegionCodes = [
  "CN", "US", "CA", "GB", "DE", "FR", "AU", "JP", "SG", "KR",
  "IN", "BR", "ZA", "NL", "SE", "NO", "DK", "CH", "IT", "ES",
  "BE", "AT", "NZ", "IE", "PT", "MX", "AR", "CL", "AE", "SA",
  "QA", "MY", "TH", "ID", "PH", "VN", "PK", "TR", "IL", "EG",
  "KE", "NG", "GH", "MA", "PL", "CZ", "HU", "FI", "IS", "LU",
] as const;

const preferredRegionCodes = ["CN", "US", "GB", "DE", "FR", "JP", "SG", "AU", "CA", "IN"] as const;

const countryOptionsCache = new Map<Locale, string[]>();
const preferredCountryOptionsCache = new Map<Locale, string[]>();

type IntlWithSupportedValuesOf = typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};

function localeToDisplayTag(locale: Locale) {
  if (locale === "zh") return "zh-CN";
  if (locale === "fr") return "fr-FR";
  if (locale === "de") return "de-DE";
  return "en-US";
}

function getRegionCodes() {
  const intlWithSupportedValuesOf = Intl as IntlWithSupportedValuesOf;

  if (typeof intlWithSupportedValuesOf.supportedValuesOf === "function") {
    try {
      return intlWithSupportedValuesOf.supportedValuesOf("region").filter((value) => /^[A-Z]{2}$/.test(value));
    } catch {
      return [...fallbackRegionCodes];
    }
  }

  return [...fallbackRegionCodes];
}

export function getCountryOptions(locale: Locale) {
  const cached = countryOptionsCache.get(locale);

  if (cached) {
    return cached;
  }

  const displayTag = localeToDisplayTag(locale);
  const displayNames = new Intl.DisplayNames([displayTag], { type: "region" });

  const options = Array.from(
    new Set(
      getRegionCodes()
        .map((code) => displayNames.of(code))
        .filter((value): value is string => Boolean(value)),
    ),
  )
    .sort((a, b) => a.localeCompare(b, displayTag));

  countryOptionsCache.set(locale, options);
  return options;
}

export function getPreferredCountryOptions(locale: Locale) {
  const cached = preferredCountryOptionsCache.get(locale);

  if (cached) {
    return cached;
  }

  const displayTag = localeToDisplayTag(locale);
  const displayNames = new Intl.DisplayNames([displayTag], { type: "region" });

  const options = preferredRegionCodes
    .map((code) => displayNames.of(code))
    .filter((value): value is string => Boolean(value));

  preferredCountryOptionsCache.set(locale, options);
  return options;
}
