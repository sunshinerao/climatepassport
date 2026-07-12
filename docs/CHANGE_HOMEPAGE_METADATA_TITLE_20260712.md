# Homepage Metadata Title Change (2026-07-12)

## 需求解读

本次变更目标是解决 Bing Webmaster Tools 报告的首页 metadata title 过长问题。只更新 Climate Passport 根首页和英文首页的 metadata title，不修改可见 Hero H1、页面内容、布局、视觉设计、canonical URL 或 hreflang。

新的首页 metadata title 为：`Climate Passport | Trusted Digital Identity for the Climate Era`。

## 修改方法

1. 在现有 SEO metadata helper 中新增独立的首页 SEO title 常量。
2. 根首页 `rootHomePageMetadata()` 使用新的 SEO title，并设置为 absolute title，避免 layout title template 追加站点名。
3. 英文 locale 首页 `homePageMetadata("en")` 使用新的 SEO title，并设置为 absolute title，避免重复生成 `| Climate Passport`。
4. 继续让可见 Hero H1 来自 `home.title`，保持 `Building trusted digital identity infrastructure for the climate era.` 不变。
5. 不修改 canonical、hreflang、页面结构或路由逻辑。

## 修改内容

- `apps/passport-web/lib/seo.ts`
  - 新增 `homeSeoTitle`。
  - 根首页 metadata title 和 Open Graph title 改为使用 `homeSeoTitle`。
  - 英文首页 metadata title 改为使用 `homeSeoTitle`。
  - 根首页和英文首页 metadata title 使用 absolute title，避免与 root layout title template 产生重复标题。
  - 非英文首页继续沿用各自 locale 的现有 title。