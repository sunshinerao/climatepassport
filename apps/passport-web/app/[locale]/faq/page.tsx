import { InfoScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";
import { infoPageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  return infoPageMetadata(params.locale, "faq");
}

export default function LocalizedFaqPage({ params }: { params: { locale: Locale } }) {
  return <InfoScreen locale={params.locale} pageKey="faq" />;
}