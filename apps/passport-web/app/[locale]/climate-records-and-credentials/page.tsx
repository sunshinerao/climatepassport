import { ClimateRecordsCredentialsScreen, climateRecordsHubDescription, climateRecordsHubPath, climateRecordsHubTitle } from "@/components/climate-records-credentials-screen";
import type { Locale } from "@/lib/site-content";
import { breadcrumbJsonLdForPath, knowledgeHubWebPageJsonLd, publicPageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  const title = climateRecordsHubTitle(params.locale);
  const description = climateRecordsHubDescription(params.locale);

  return {
    ...publicPageMetadata({
      locale: params.locale,
      path: climateRecordsHubPath,
      title,
      description,
      keywords: ["climate credentials", "climate records", "credential verification", "climate digital identity", "Climate Passport"],
    }),
    title: { absolute: title },
  };
}

export default function ClimateRecordsAndCredentialsPage({ params }: { params: { locale: Locale } }) {
  const title = climateRecordsHubTitle(params.locale);
  const description = climateRecordsHubDescription(params.locale);

  const structuredData = [
    knowledgeHubWebPageJsonLd(params.locale, title, description),
    breadcrumbJsonLdForPath(params.locale, `/${params.locale}${climateRecordsHubPath}`),
  ].filter(Boolean);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <ClimateRecordsCredentialsScreen locale={params.locale} />
    </>
  );
}