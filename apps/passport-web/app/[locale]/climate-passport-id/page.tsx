import { EntityTopicScreen, getEntityTopicContent } from "@/components/entity-topic-screen";
import type { Locale } from "@/lib/site-content";
import { publicPageMetadata } from "@/lib/seo";

const topic = "climate-passport-id";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  const content = getEntityTopicContent(topic, params.locale);

  return publicPageMetadata({
    locale: params.locale,
    path: "/climate-passport-id",
    title: content.title,
    description: content.intro,
    keywords: ["Climate Passport ID", "climate identity", "digital identity", "Climate Passport"],
  });
}

export default function ClimatePassportIdPage({ params }: { params: { locale: Locale } }) {
  return <EntityTopicScreen locale={params.locale} topic={topic} />;
}