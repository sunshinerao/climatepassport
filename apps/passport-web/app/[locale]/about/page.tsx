import { InfoScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";
import { aboutPageJsonLd, infoPageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  return infoPageMetadata(params.locale, "about");
}

export default function LocalizedAboutPage({ params }: { params: { locale: Locale } }) {
  const structuredData = aboutPageJsonLd(params.locale);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <InfoScreen locale={params.locale} pageKey="about" />
    </>
  );
}
