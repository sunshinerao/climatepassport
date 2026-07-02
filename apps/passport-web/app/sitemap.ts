import type { MetadataRoute } from "next";
import { locales } from "@/lib/site-content";
import { getPrismaClient } from "@/lib/server/prisma";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://climatepass.org").replace(/\/$/, "");

export const dynamic = "force-dynamic";

const publicRoutes = [
  "",
  "/about",
  "/activities",
  "/certificates",
  "/contact",
  "/events",
  "/faq",
  "/privacy",
  "/speakers",
  "/terms",
];

const routePriority = new Map<string, number>([
  ["", 1],
  ["/activities", 0.8],
  ["/certificates", 0.8],
  ["/events", 0.8],
  ["/speakers", 0.7],
  ["/about", 0.6],
  ["/contact", 0.5],
  ["/faq", 0.5],
  ["/privacy", 0.3],
  ["/terms", 0.3],
]);

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
      url: `${siteUrl}/${locale}${route}`,
      lastModified: now,
      changeFrequency: route === "" ? "weekly" as const : "monthly" as const,
      priority: routePriority.get(route) ?? 0.5,
    })),
  );

  const activityDetailRoutes = locales.flatMap((locale) =>
    activityRoutes.map((activity) => ({
      url: `${siteUrl}/${locale}/activities/${activity.slug}`,
      lastModified: activity.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  );

  return [...staticRoutes, ...activityDetailRoutes];
}
