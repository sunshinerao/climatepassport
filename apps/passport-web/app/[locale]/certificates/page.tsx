import { CertificatesScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";
import { platformPageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  return platformPageMetadata(params.locale, "certificates");
}

export default function LocalizedCertificatesPage({ params }: { params: { locale: Locale } }) {
  return <CertificatesScreen locale={params.locale} />;
}