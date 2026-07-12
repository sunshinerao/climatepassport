# Homepage Metadata Description Change (2026-07-12)

## 需求解读

本次变更目标是解决 Bing Webmaster Tools Live URL 报告的首页 meta description 长度问题。只更新 Climate Passport 根首页和英文首页的 metadata description，不修改可见页面内容、Hero H1、metadata title、canonical URL、hreflang、JSON-LD entity definitions、页面设计或应用逻辑。

新的首页 metadata description 为：`Climate Passport is a trusted digital identity platform for climate learning, participation, credentials and verifiable action records.`

## 修改方法

1. 在现有 SEO metadata helper 中新增独立的首页 SEO description 常量。
2. 根首页 `rootHomePageMetadata()` 使用新的 SEO description。
3. 英文 locale 首页 `homePageMetadata("en")` 使用新的 SEO description。
4. 继续让可见首页正文来自 `home.body`，不改字典内容或 Hero 展示文案。
5. 不修改默认 `defaultSeoDescription`，避免影响 JSON-LD entity definitions 和其他全站默认描述。
6. 不修改 canonical、hreflang、title、页面结构或路由逻辑。

## 修改内容

- `apps/passport-web/lib/seo.ts`
  - 新增 `homeSeoDescription`。
  - 根首页标准 description、Open Graph description、Twitter description 改为使用 `homeSeoDescription`。
  - 英文首页标准 description、Open Graph description、Twitter description 改为使用 `homeSeoDescription`。
  - 非英文首页继续沿用各自 locale 的现有首页正文作为 metadata description。