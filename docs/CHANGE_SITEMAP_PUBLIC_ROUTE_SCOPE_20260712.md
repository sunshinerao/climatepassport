# Sitemap Public Route Scope - 2026-07-12

## 需求解读

SEO/GEO sitemap should prioritize durable product, entity, knowledge, legal and trust pages. Business or operational listing pages such as activities, event discovery, speakers, contact and certificate verification should remain accessible in the frontend, but should not be actively promoted through `sitemap.xml`.

## 修改方法

Narrow the `publicRoutes` list in `apps/passport-web/app/sitemap.ts` to stable informational and entity pages. Remove activity detail sitemap generation so database-driven activity URLs are not emitted into `sitemap.xml`. Keep all existing routes and redirect pages available for users and direct links.

## 修改内容

- Removed `/activities`, `/certificate-verification`, `/contact`, `/events`, and `/speakers` from sitemap static public routes.
- Removed dynamic `/[locale]/activities/{slug}` sitemap generation.
- Removed the Prisma dependency from sitemap generation because activity records are no longer queried for sitemap output.
- Kept sitemap coverage for homepage, About, certificates, Climate Passport ID, Climate Records and Credentials, FAQ, privacy, terms, and verifiable credentials.