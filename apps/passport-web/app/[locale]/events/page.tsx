import { EventsScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedEventsPage({ params }: { params: { locale: Locale } }) {
  return <EventsScreen locale={params.locale} />;
}