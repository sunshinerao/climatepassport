import { NextResponse } from "next/server";
import { absoluteUrl, defaultSeoDescription, siteName } from "@/lib/seo";

const content = `# ${siteName}

${defaultSeoDescription}

## Primary Pages

- Home: ${absoluteUrl("/")}
- Activities: ${absoluteUrl("/en/activities")}
- Certificates: ${absoluteUrl("/en/certificates")}
- Events: ${absoluteUrl("/en/events")}
- Speakers: ${absoluteUrl("/en/speakers")}
- About: ${absoluteUrl("/en/about")}
- Contact: ${absoluteUrl("/en/contact")}
- FAQ: ${absoluteUrl("/en/faq")}

## Locales

- English: ${absoluteUrl("/en")}
- Chinese: ${absoluteUrl("/zh")}
- French: ${absoluteUrl("/fr")}
- German: ${absoluteUrl("/de")}

## Machine-Readable Discovery

- Sitemap: ${absoluteUrl("/sitemap.xml")}
- Robots: ${absoluteUrl("/robots.txt")}

## Crawling Guidance

Public marketing, activities, events, speakers, certificate information, FAQ, and policy pages may be used for search indexing, AI search grounding, and answer generation with attribution to Climate Passport.

Do not index or use private account, admin, dashboard, authentication, API, profile, or tokenized verification pages as public source material.
`;

export function GET() {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
