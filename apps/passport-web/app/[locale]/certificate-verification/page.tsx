import { EntityTopicScreen, getEntityTopicContent } from "@/components/entity-topic-screen";
import type { Locale } from "@/lib/site-content";
import { publicPageMetadata } from "@/lib/seo";

const topic = "certificate-verification";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  const content = getEntityTopicContent(topic, params.locale);

  return publicPageMetadata({
    locale: params.locale,
    path: "/certificate-verification",
    title: content.title,
    description: content.intro,
    keywords: ["Climate Passport certificate verification", "verify climate certificate", "verifiable credentials", "Climate Passport"],
  });
}

export default function CertificateVerificationPage({ params }: { params: { locale: Locale } }) {
  return <EntityTopicScreen locale={params.locale} topic={topic} />;
}