import type { Metadata } from "next";
import { headers } from "next/headers";
import { defaultSeoDescription, defaultSeoTitle, definedTermsJsonLd, localeLanguageTags, organizationJsonLd, siteName, siteUrl, softwareApplicationJsonLd, websiteJsonLd } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultSeoTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultSeoDescription,
  applicationName: siteName,
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  category: "Climate technology",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName,
    url: siteUrl,
    title: defaultSeoTitle,
    description: defaultSeoDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultSeoTitle,
    description: defaultSeoDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

function getDocumentLang(pathname: string | null) {
  const locale = pathname?.split("/").filter(Boolean)[0] as keyof typeof localeLanguageTags | undefined;
  return locale && locale in localeLanguageTags ? localeLanguageTags[locale] : localeLanguageTags.en;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = [organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd(), definedTermsJsonLd()];
  const documentLang = getDocumentLang(headers().get("x-pathname"));

  return (
    <html lang={documentLang}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        {children}
      </body>
    </html>
  );
}