import { SpeakersScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedSpeakersPage({ params }: { params: { locale: Locale } }) {
  return <SpeakersScreen locale={params.locale} />;
}