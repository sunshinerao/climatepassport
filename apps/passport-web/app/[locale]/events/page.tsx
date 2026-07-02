import { EventsScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";
import { platformPageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  return platformPageMetadata(params.locale, "events");
}

export default function LocalizedEventsPage({ params }: { params: { locale: Locale } }) {
  return <EventsScreen locale={params.locale} />;
}