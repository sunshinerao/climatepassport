import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.climatepass.org").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/auth/",
        "/dashboard/",
        "/profile/",
        "/en/admin/",
        "/en/auth/",
        "/en/dashboard/",
        "/en/profile/",
        "/zh/admin/",
        "/zh/auth/",
        "/zh/dashboard/",
        "/zh/profile/",
        "/fr/admin/",
        "/fr/auth/",
        "/fr/dashboard/",
        "/fr/profile/",
        "/de/admin/",
        "/de/auth/",
        "/de/dashboard/",
        "/de/profile/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
