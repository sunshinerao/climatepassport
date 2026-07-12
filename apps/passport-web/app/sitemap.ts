import type { MetadataRoute } from "next";
import { locales } from "@/lib/site-content";
import { absoluteUrl, localeLanguageTags, localizedPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

const publicRoutes = [
  "",
  "/about",
  "/certificates",
  "/climate-records-and-credentials",
  "/climate-passport-id",
  "/faq",
  "/privacy",
  "/terms",
  "/verifiable-credentials",
];

const routePriority = new Map<string, number>([
  ["", 1],
  ["/climate-records-and-credentials", 0.75],
  ["/climate-passport-id", 0.8],
  ["/verifiable-credentials", 0.8],
  ["/certificates", 0.8],
  ["/about", 0.6],
  ["/faq", 0.5],
  ["/privacy", 0.3],
  ["/terms", 0.3],
]);

function localizedUrl(locale: string, route = "") {
  return absoluteUrl(`/${locale}${route}`);
}

function localizedAlternates(route = "") {
  return {
    languages: {
      ...Object.fromEntries(
        locales.map((locale) => [localeLanguageTags[locale], absoluteUrl(localizedPath(locale, route))]),
      ),
      "x-default": route === "" ? absoluteUrl("/") : absoluteUrl(localizedPath("en", route)),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes = locales.flatMap((locale) =>
    publicRoutes.map((route) => ({
      url: localizedUrl(locale, route),
      lastModified: now,
      changeFrequency: route === "" ? "weekly" as const : "monthly" as const,
      priority: routePriority.get(route) ?? 0.5,
      alternates: localizedAlternates(route),
    })),
  );

  const rootRoute = {
    url: absoluteUrl("/"),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 1,
    alternates: localizedAlternates(""),
  };

  return [rootRoute, ...staticRoutes];
}
