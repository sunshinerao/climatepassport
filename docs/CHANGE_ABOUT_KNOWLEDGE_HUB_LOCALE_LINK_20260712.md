# About Knowledge Hub Locale Link - 2026-07-12

## 需求解读

The GEO entity consistency review found that About page internal linking should point readers and crawlers to the same-locale Climate Records and Credentials guide. Cross-linking non-English About pages to the English guide weakens locale-aware entity paths.

## 修改方法

Keep the existing About page structure and add localized link text plus locale-aware href generation for the Knowledge Hub link in the verifiable credentials section.

## 修改内容

- Updated `apps/passport-web/components/about-entity-screen.tsx` so en/zh/fr/de About pages link to `/{locale}/climate-records-and-credentials`.
- Added localized link text for English, Chinese, French and German.