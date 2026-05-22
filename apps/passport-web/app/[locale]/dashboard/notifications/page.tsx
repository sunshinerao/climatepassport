import { NotificationsScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedNotificationsPage({ params }: { params: { locale: Locale } }) {
  return <NotificationsScreen locale={params.locale} />;
}