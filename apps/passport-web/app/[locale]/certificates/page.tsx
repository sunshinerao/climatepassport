import { CertificatesScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedCertificatesPage({ params }: { params: { locale: Locale } }) {
  return <CertificatesScreen locale={params.locale} />;
}