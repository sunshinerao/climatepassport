# Sitemap XML Setup Changes (2026-07-12)

## 需求解读

本次变更目标是建立并完善 Climate Passport 的 `sitemap.xml`，让搜索引擎和 AI crawler 能稳定发现公开页面、多语言页面和公开活动详情页。仓库中已有 Next.js metadata route `app/sitemap.ts`，因此本次工作重点不是新增重复静态文件，而是把现有动态 sitemap 升级为正式可维护的 sitemap 生成源。

## 修改方法

1. 继续使用 Next.js App Router 的 `app/sitemap.ts` 输出 `/sitemap.xml`。
2. 复用 `lib/seo.ts` 中的 canonical host、absolute URL 和 localized path helper，避免 sitemap 与全站 canonical 配置分叉。
3. 为根路径、公开静态页面和公开活动详情页增加多语言 `alternates.languages`，使 sitemap 输出 hreflang alternate links。
4. 保留动态读取公开活动详情的逻辑，只收录 `PUBLISHED` / `ONGOING` 且 `PUBLIC` 的 activity。
5. 不收录 admin、auth、dashboard、profile、verifier console、token/code 型验证详情等私有或参数化页面。
6. 从 AI Entity Visibility、SEO 与 GEO 角度补齐缺失的解释型公开实体页，并加入 sitemap：Climate Passport ID、verifiable credentials、certificate verification。

## 修改内容

- `apps/passport-web/app/sitemap.ts`
  - 改为使用 `absoluteUrl`、`localizedPath`、`localeLanguageTags` 生成 sitemap URL。
  - 为根页、公开静态页、公开活动详情页增加 hreflang alternate links。
  - 新增 `/climate-passport-id`、`/verifiable-credentials`、`/certificate-verification` 多语言 sitemap 条目。
  - 保留现有公开活动详情动态收录策略。
- `apps/passport-web/components/entity-topic-screen.tsx`
  - 新增面向 AI 和搜索引擎的解释型实体页面组件。
- `apps/passport-web/app/[locale]/climate-passport-id/page.tsx`
  - 新增 Climate Passport ID 多语言公开解释页。
- `apps/passport-web/app/[locale]/verifiable-credentials/page.tsx`
  - 新增 Climate Passport verifiable credentials 多语言公开解释页。
- `apps/passport-web/app/[locale]/certificate-verification/page.tsx`
  - 新增 Climate Passport certificate verification 多语言公开解释页。
- `apps/passport-web/app/robots.ts`
  - 已有 `sitemap: https://www.climatepass.org/sitemap.xml` 配置，本次无需修改。

## 必要但此前缺失的页面

- `Climate Passport ID`：站内多处使用 Passport ID，但此前没有独立可索引解释页。
- `Verifiable credentials`：站内有证书与资质能力，但此前缺少面向机器理解的标准资质解释页。
- `Certificate verification`：动态证书验证 URL 需要 code，不适合直接列入 sitemap；因此需要一个公开、稳定、可索引的验证说明页。