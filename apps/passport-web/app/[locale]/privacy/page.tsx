import { PrivacyPolicyScreen } from "@/components/privacy-policy-screen";
import type { Locale } from "@/lib/site-content";

export default function LocalizedPrivacyPage({ params }: { params: { locale: Locale } }) {
  return <PrivacyPolicyScreen locale={params.locale} />;
}