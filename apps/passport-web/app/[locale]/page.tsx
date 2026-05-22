import { HomeScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedHomePage({ params }: { params: { locale: Locale } }) {
  return <HomeScreen locale={params.locale} />;
}