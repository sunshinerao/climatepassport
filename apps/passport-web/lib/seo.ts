import type { Metadata } from "next";
import { getDictionary, locales, type Locale } from "@/lib/site-content";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.climatepass.org").replace(/\/$/, "");

export const siteName = "Climate Passport";
export const defaultSeoTitle = "Climate Passport | Verified climate identity, credentials, and action records";
export const defaultSeoDescription =
  "Climate Passport is a trusted digital identity platform for climate learning, participation, certificates, and verifiable action records.";

export const localeLanguageTags: Record<Locale, string> = {
  en: "en",
  zh: "zh-CN",
  fr: "fr",
  de: "de",
};

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "Chinese",
  fr: "French",
  de: "German",
};

export function absoluteUrl(path = "/") {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function localizedPath(locale: Locale, path = "") {
  const normalizedPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalizedPath}`;
}

export function localizedAlternates(path = "") {
  const languages = Object.fromEntries(
    locales.map((locale) => [localeLanguageTags[locale], absoluteUrl(localizedPath(locale, path))]),
  );

  return {
    canonical: absoluteUrl(localizedPath("en", path)),
    languages: {
      ...languages,
      "x-default": absoluteUrl(localizedPath("en", path)),
    },
  };
}

export function publicPageMetadata(options: {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
  keywords?: string[];
}): Metadata {
  const url = absoluteUrl(localizedPath(options.locale, options.path ?? ""));

  return {
    title: options.title,
    description: options.description,
    keywords: options.keywords,
    alternates: localizedAlternates(options.path ?? ""),
    openGraph: {
      type: "website",
      siteName,
      locale: localeLanguageTags[options.locale],
      url,
      title: options.title,
      description: options.description,
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export function homePageMetadata(locale: Locale): Metadata {
  const { home } = getDictionary(locale);

  return publicPageMetadata({
    locale,
    title: home.title,
    description: home.body,
    keywords: ["Climate Passport", "climate identity", "verified climate credentials", "climate action records"],
  });
}

export function rootHomePageMetadata(): Metadata {
  const { home } = getDictionary("en");
  const languages = Object.fromEntries(
    locales.map((locale) => [localeLanguageTags[locale], absoluteUrl(localizedPath(locale))]),
  );

  return {
    ...publicPageMetadata({
      locale: "en",
      title: home.title,
      description: home.body,
      keywords: ["Climate Passport", "climate identity", "verified climate credentials", "climate action records"],
    }),
    alternates: {
      canonical: absoluteUrl("/"),
      languages: {
        ...languages,
        "x-default": absoluteUrl("/"),
      },
    },
    openGraph: {
      type: "website",
      siteName,
      locale: localeLanguageTags.en,
      url: absoluteUrl("/"),
      title: home.title,
      description: home.body,
    },
  };
}

export function platformPageMetadata(
  locale: Locale,
  page: "activities" | "certificates" | "events" | "speakers",
): Metadata {
  const dictionary = getDictionary(locale);
  const content = page === "activities" ? dictionary.events : dictionary[page];

  return publicPageMetadata({
    locale,
    path: `/${page}`,
    title: content.title,
    description: content.intro,
    keywords: ["Climate Passport", content.label, content.title, "climate credentials"],
  });
}

export function infoPageMetadata(locale: Locale, page: "about" | "contact" | "faq" | "privacy" | "terms"): Metadata {
  const content = getDictionary(locale).info[page];

  return publicPageMetadata({
    locale,
    path: `/${page}`,
    title: content.title,
    description: content.intro,
    keywords: ["Climate Passport", content.label, content.title],
  });
}

export const privatePageMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    email: "contact@climatepass.org",
    description: defaultSeoDescription,
    sameAs: [siteUrl],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    inLanguage: locales.map((locale) => localeLanguageTags[locale]),
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/en/events?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description: defaultSeoDescription,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}
