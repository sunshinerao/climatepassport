import { MessagesScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedMessagesPage({ params }: { params: { locale: Locale } }) {
  return <MessagesScreen locale={params.locale} />;
}