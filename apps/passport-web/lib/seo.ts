import type { Metadata } from "next";
import { getDictionary, locales, type Locale } from "@/lib/site-content";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.climatepass.org").replace(/\/$/, "");

export const siteName = "Climate Passport";
export const defaultSeoTitle = "Climate Passport | Verified climate identity, credentials, and action records";
export const homeSeoTitle = "Climate Passport | Trusted Digital Identity for the Climate Era";
export const homeSeoDescription =
  "Climate Passport is a trusted digital identity platform for climate learning, participation, credentials and verifiable action records.";
export const climatePassportDefinition =
  "Climate Passport is an AI-driven trusted digital identity infrastructure for the climate era, designed to turn climate learning, participation, credentials and action into a verifiable, portable and continuously growing digital profile.";
export const defaultSeoDescription =
  climatePassportDefinition;

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

export const organizationId = `${siteUrl}/#organization`;
export const websiteId = `${siteUrl}/#website`;
export const softwareApplicationId = `${siteUrl}/#software`;
export const definedTermSetId = `${siteUrl}/#climate-passport-terms`;

export function absoluteUrl(path = "/") {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function localizedPath(locale: Locale, path = "") {
  const normalizedPath = path === "" || path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalizedPath}`;
}

export function localizedAlternates(locale: Locale, path = "") {
  const languages = Object.fromEntries(
    locales.map((locale) => [localeLanguageTags[locale], localizedPath(locale, path)]),
  );

  return {
    canonical: path === "" || path === "/" ? new URL(absoluteUrl(localizedPath(locale, path))) : localizedPath(locale, path),
    languages: {
      ...languages,
      "x-default": path === "" || path === "/" ? "/" : localizedPath("en", path),
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
    alternates: localizedAlternates(options.locale, options.path ?? ""),
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

  const metadata = publicPageMetadata({
    locale,
    title: locale === "en" ? homeSeoTitle : home.title,
    description: locale === "en" ? homeSeoDescription : home.body,
    keywords: ["Climate Passport", "climate identity", "verified climate credentials", "climate action records"],
  });

  return locale === "en" ? { ...metadata, title: { absolute: homeSeoTitle } } : metadata;
}

export function rootHomePageMetadata(): Metadata {
  const { home } = getDictionary("en");

  return {
    ...publicPageMetadata({
      locale: "en",
      title: homeSeoTitle,
      description: homeSeoDescription,
      keywords: ["Climate Passport", "climate identity", "verified climate credentials", "climate action records"],
    }),
    title: { absolute: homeSeoTitle },
    alternates: {
      canonical: new URL(absoluteUrl("/")),
      languages: {
        ...Object.fromEntries(locales.map((locale) => [localeLanguageTags[locale], localizedPath(locale)])),
        "x-default": "/",
      },
    },
    openGraph: {
      type: "website",
      siteName,
      locale: localeLanguageTags.en,
      url: absoluteUrl("/"),
      title: homeSeoTitle,
      description: homeSeoDescription,
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
    "@id": organizationId,
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
    "@id": websiteId,
    name: siteName,
    url: siteUrl,
    publisher: { "@id": organizationId },
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
    "@id": softwareApplicationId,
    name: siteName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description: defaultSeoDescription,
    provider: { "@id": organizationId },
    publisher: { "@id": organizationId },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function definedTermsJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": definedTermSetId,
    name: "Climate Passport terminology",
    url: siteUrl,
    publisher: { "@id": organizationId },
    hasDefinedTerm: [
      {
        "@type": "DefinedTerm",
        name: "Climate Passport",
        description: defaultSeoDescription,
      },
      {
        "@type": "DefinedTerm",
        name: "verified climate credentials",
        description: "Verifiable credential records that contribute to a portable Climate Passport digital profile for climate learning, participation, and action.",
      },
      {
        "@type": "DefinedTerm",
        name: "climate action records",
        description: "Learning, participation, credential, and action records associated with a continuously growing Climate Passport digital profile.",
      },
      {
        "@type": "DefinedTerm",
        name: "certificate verification",
        description: "Public verification of Climate Passport certificate records through the platform verification portal.",
      },
    ],
  };
}

export function aboutPageJsonLd(locale: Locale) {
  const content = getDictionary(locale).info.about;
  const url = absoluteUrl(localizedPath(locale, "/about"));

  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${url}#about-page`,
    url,
    name: content.title,
    description: content.intro,
    inLanguage: localeLanguageTags[locale],
    isPartOf: { "@id": websiteId },
    about: { "@id": organizationId },
    publisher: { "@id": organizationId },
  };
}

const privatePathPrefixes = ["/admin", "/auth", "/dashboard", "/profile", "/api"];

const breadcrumbLabels: Record<string, string> = {
  about: "About",
  activities: "Activities",
  "climate-records-and-credentials": "Climate Records and Credentials",
  certificates: "Certificates",
  contact: "Contact",
  events: "Events",
  faq: "FAQ",
  privacy: "Privacy",
  speakers: "Speakers",
  terms: "Terms",
  verify: "Verify",
  verifier: "Verifier",
};

function humanizeSegment(segment: string) {
  return breadcrumbLabels[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function knowledgeHubWebPageJsonLd() {
  const url = absoluteUrl(localizedPath("en", "/climate-records-and-credentials"));

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: "Climate Records & Credentials | Climate Passport",
    description: "A practical guide to climate credentials, verification, learning records, participation records, action records and climate digital identity.",
    inLanguage: localeLanguageTags.en,
    isPartOf: { "@id": websiteId },
    about: { "@id": organizationId },
    publisher: { "@id": organizationId },
  };
}

export function breadcrumbJsonLdForPath(locale: Locale, pathname: string) {
  const localePrefix = `/${locale}`;
  if (!pathname.startsWith(localePrefix)) {
    return null;
  }

  const pathAfterLocale = pathname.slice(localePrefix.length) || "/";
  if (privatePathPrefixes.some((prefix) => pathAfterLocale === prefix || pathAfterLocale.startsWith(`${prefix}/`))) {
    return null;
  }

  const segments = pathAfterLocale.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const itemListElement = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: absoluteUrl(localizedPath(locale)),
    },
    ...segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join("/")}`;
      return {
        "@type": "ListItem",
        position: index + 2,
        name: humanizeSegment(segment),
        item: absoluteUrl(localizedPath(locale, path)),
      };
    }),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}

export function activityEventJsonLd(activity: {
  slug: string;
  type: string;
  title: string;
  titleEn: string | null;
  summary: string | null;
  summaryEn: string | null;
  startTime: Date | null;
  endTime: Date | null;
  locationType: string | null;
  organizerName: string | null;
}, locale: Locale) {
  if (activity.type !== "EVENT" || !activity.startTime) {
    return null;
  }

  const url = absoluteUrl(localizedPath(locale, `/activities/${activity.slug}`));
  const zh = locale === "zh";
  const name = zh ? activity.title : activity.titleEn ?? activity.title;
  const description = zh ? activity.summary ?? activity.summaryEn : activity.summaryEn ?? activity.summary;
  const attendanceMode = activity.locationType === "ONLINE"
    ? "https://schema.org/OnlineEventAttendanceMode"
    : activity.locationType === "HYBRID"
      ? "https://schema.org/MixedEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode";

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#event`,
    name,
    description: description ?? defaultSeoDescription,
    url,
    inLanguage: localeLanguageTags[locale],
    startDate: activity.startTime.toISOString(),
    endDate: activity.endTime?.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: attendanceMode,
    location: activity.locationType === "ONLINE"
      ? { "@type": "VirtualLocation", url }
      : { "@type": "Place", name: activity.locationType ?? "Event venue" },
    organizer: activity.organizerName
      ? { "@type": "Organization", name: activity.organizerName }
      : { "@id": organizationId },
    isAccessibleForFree: true,
  };
}
