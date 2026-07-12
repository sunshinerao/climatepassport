import { EntityTopicScreen, getEntityTopicContent } from "@/components/entity-topic-screen";
import type { Locale } from "@/lib/site-content";
import { publicPageMetadata } from "@/lib/seo";

const topic = "verifiable-credentials";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  const content = getEntityTopicContent(topic, params.locale);

  return publicPageMetadata({
    locale: params.locale,
    path: "/verifiable-credentials",
    title: content.title,
    description: content.intro,
    keywords: ["Climate Passport verifiable credentials", "verified climate credentials", "climate certificates", "Climate Passport"],
  });
}

export default function VerifiableCredentialsPage({ params }: { params: { locale: Locale } }) {
  return <EntityTopicScreen locale={params.locale} topic={topic} />;
}