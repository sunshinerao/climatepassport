# Public Route Redirects - 2026-07-12

## 需求解读

部分多语言公开页面已经存在 `/en`、`/zh`、`/fr`、`/de` 版本并进入 sitemap，但未加语言前缀的访问路径会 404。为避免用户、搜索引擎或 AI bot 访问无前缀 URL 时遇到断点，需要补齐与既有 `/about -> /en/about`、`/events -> /en/events` 一致的英文默认重定向入口。

## 修改方法

对缺少根级入口的多语言公开页面新增 App Router redirect page。每个无语言前缀路径只做一件事：重定向到对应英文页面，保持 canonical 和 hreflang 仍由 `/[locale]` 页面负责生成。

## 修改内容

- 新增 `apps/passport-web/app/activities/page.tsx`，将 `/activities` 重定向到 `/en/activities`。
- 新增 `apps/passport-web/app/certificate-verification/page.tsx`，将 `/certificate-verification` 重定向到 `/en/certificate-verification`。
- 新增 `apps/passport-web/app/climate-passport-id/page.tsx`，将 `/climate-passport-id` 重定向到 `/en/climate-passport-id`。
- 新增 `apps/passport-web/app/verifiable-credentials/page.tsx`，将 `/verifiable-credentials` 重定向到 `/en/verifiable-credentials`。
- 保持 sitemap 多语言 URL 不变，避免把无语言前缀兼容入口作为 canonical 内容页。