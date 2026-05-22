import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { isSupportedLocale, locales, type Locale } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  if (!isSupportedLocale(params.locale)) {
    notFound();
  }

  return <SiteShell locale={params.locale as Locale}>{children}</SiteShell>;
}