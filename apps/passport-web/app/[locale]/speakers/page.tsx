import { SpeakersScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";
import { platformPageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  return platformPageMetadata(params.locale, "speakers");
}

export default function LocalizedSpeakersPage({ params }: { params: { locale: Locale } }) {
  return <SpeakersScreen locale={params.locale} />;
}