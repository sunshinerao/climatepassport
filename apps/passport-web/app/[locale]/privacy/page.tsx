import { PrivacyPolicyScreen } from "@/components/privacy-policy-screen";
import type { Locale } from "@/lib/site-content";
import { infoPageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  return infoPageMetadata(params.locale, "privacy");
}

export default function LocalizedPrivacyPage({ params }: { params: { locale: Locale } }) {
  return <PrivacyPolicyScreen locale={params.locale} />;
}