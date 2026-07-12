import type { MetadataRoute } from "next";
import { locales } from "@/lib/site-content";
import { getPrismaClient } from "@/lib/server/prisma";
import { absoluteUrl, localeLanguageTags, localizedPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

const publicRoutes = [
  "",
  "/about",
  "/activities",
  "/certificate-verification",
  "/certificates",
  "/climate-records-and-credentials",
  "/climate-passport-id",
  "/contact",
  "/events",
  "/faq",
  "/privacy",
  "/speakers",
  "/terms",
  "/verifiable-credentials",
];

const routePriority = new Map<string, number>([
  ["", 1],
  ["/activities", 0.8],
  ["/climate-records-and-credentials", 0.75],
  ["/climate-passport-id", 0.8],
  ["/verifiable-credentials", 0.8],
  ["/certificate-verification", 0.75],
  ["/certificates", 0.8],
  ["/events", 0.8],
  ["/speakers", 0.7],
  ["/about", 0.6],
  ["/contact", 0.5],
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

async function getPublicActivityRoutes() {
  const prisma = getPrismaClient();
  if (!prisma) {
    return [];
  }

  try {
    return await prisma.activity.findMany({
      where: {
        status: { in: ["PUBLISHED", "ONGOING"] },
        visibility: "PUBLIC",
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: {
        slug: true,
        updatedAt: true,
      },
    });
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const activityRoutes = await getPublicActivityRoutes();

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

  const activityDetailRoutes = locales.flatMap((locale) =>
    activityRoutes.map((activity) => ({
      url: localizedUrl(locale, `/activities/${activity.slug}`),
      lastModified: activity.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: localizedAlternates(`/activities/${activity.slug}`),
    })),
  );

  return [rootRoute, ...staticRoutes, ...activityDetailRoutes];
}
