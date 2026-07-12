import { notFound } from "next/navigation";
import { ClimateRecordsCredentialsScreen, climateRecordsHubDescription, climateRecordsHubPath, climateRecordsHubTitle } from "@/components/climate-records-credentials-screen";
import type { Locale } from "@/lib/site-content";
import { breadcrumbJsonLdForPath, knowledgeHubWebPageJsonLd, publicPageMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { locale: Locale } }) {
  if (params.locale !== "en") {
    return {};
  }

  return {
    ...publicPageMetadata({
      locale: "en",
      path: climateRecordsHubPath,
      title: climateRecordsHubTitle,
      description: climateRecordsHubDescription,
      keywords: ["climate credentials", "climate records", "credential verification", "climate digital identity", "Climate Passport"],
    }),
    title: { absolute: climateRecordsHubTitle },
    alternates: {
      canonical: climateRecordsHubPath,
      languages: {
        en: climateRecordsHubPath,
        "x-default": climateRecordsHubPath,
      },
    },
  };
}

export default function ClimateRecordsAndCredentialsPage({ params }: { params: { locale: Locale } }) {
  if (params.locale !== "en") {
    notFound();
  }

  const structuredData = [
    knowledgeHubWebPageJsonLd(),
    breadcrumbJsonLdForPath("en", `/en${climateRecordsHubPath}`),
  ].filter(Boolean);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <ClimateRecordsCredentialsScreen />
    </>
  );
}