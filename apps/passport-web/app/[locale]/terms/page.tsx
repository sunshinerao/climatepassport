import { InfoScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedTermsPage({ params }: { params: { locale: Locale } }) {
  return <InfoScreen locale={params.locale} pageKey="terms" />;
}