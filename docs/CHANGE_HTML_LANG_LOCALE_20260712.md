# HTML Lang Locale Signal - 2026-07-12

## 需求解读

Production canonical audit found that non-English sitemap pages are canonical, indexable and hreflang-correct, but the document root still renders `<html lang="en">` for `/zh`, `/fr` and `/de` URLs. This weakens multilingual SEO/GEO and AI language interpretation.

## 修改方法

Use the pathname injected by middleware to derive the first URL segment in the root layout. When the segment is a supported locale, render the corresponding `localeLanguageTags` value on the document `<html>` element; otherwise default to English for root and unprefixed redirect pages.

## 修改内容

- Updated `apps/passport-web/app/layout.tsx` so `/zh...` renders `lang="zh-CN"`, `/fr...` renders `lang="fr"`, `/de...` renders `lang="de"`, and `/en...` plus `/` render `lang="en"`.
- Kept canonical, hreflang, sitemap and route behavior unchanged.