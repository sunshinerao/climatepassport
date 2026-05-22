import { ClimatePassportScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedClimatePassportPage({ params }: { params: { locale: Locale } }) {
  return <ClimatePassportScreen locale={params.locale} />;
}