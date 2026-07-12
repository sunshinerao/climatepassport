import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { breadcrumbJsonLdForPath } from "@/lib/seo";
import { isSupportedLocale, locales, type Locale } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  if (!isSupportedLocale(params.locale)) {
    notFound();
  }

  const pathname = headers().get("x-pathname") ?? `/${params.locale}`;
  const breadcrumbJsonLd = breadcrumbJsonLdForPath(params.locale as Locale, pathname);

  return (
    <SiteShell locale={params.locale as Locale}>
      {breadcrumbJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />}
      {children}
    </SiteShell>
  );
}
