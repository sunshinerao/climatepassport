import { HomeScreen } from "@/components/platform-screens";
import { notFound } from "next/navigation";
import { isSupportedLocale, type Locale } from "@/lib/site-content";
import { homePageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  return homePageMetadata(params.locale);
}

export default function LocalizedHomePage({ params }: { params: { locale: string } }) {
  if (!isSupportedLocale(params.locale)) {
    notFound();
  }

  return <HomeScreen locale={params.locale as Locale} />;
}