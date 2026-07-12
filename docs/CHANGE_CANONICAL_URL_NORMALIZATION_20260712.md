# Canonical URL Normalization Changes (2026-07-12)

## 需求解读

本次变更目标是修复英文首页 `/en` 的 canonical 与生产重定向策略不一致问题。生产中 `/en/` 会 308 跳转到 `/en`，因此英文首页 canonical、hreflang 和 sitemap 均应使用最终 200 URL `https://www.climatepass.org/en`，而不是带尾斜杠的 `https://www.climatepass.org/en/`。

同时，中文、法语、德语首页也应使用无尾斜杠 canonical：`/zh`、`/fr`、`/de`。根首页 canonical 保持 `https://www.climatepass.org` / `https://www.climatepass.org/` 语义不变。

## 修改方法

1. 不修改现有 Next.js redirect 行为。
2. 修正 locale path helper 对空路径的处理，使 `localizedPath("en")` 输出 `/en`，而不是 `/en/`。
3. 对 locale 首页 canonical 使用显式 `URL` 对象，避免 Next 对首页 canonical 自动补尾斜杠。
4. 内容页继续使用相对 metadata alternates，保持多语言 hreflang 正确解析为对应 locale 内容页。
5. 显式声明 `trailingSlash: false`，让 Next 配置与生产中 `/en/ -> /en` 的最终 URL 策略一致。
6. 不修改页面内容、视觉设计或应用业务逻辑。

## 修改内容

- `apps/passport-web/lib/seo.ts`
  - `localizedPath()` 将空路径和 `/` 都规范化为空 suffix，输出 `/en`、`/zh`、`/fr`、`/de`。
  - `localizedAlternates()` 对 locale 首页 canonical 使用显式 URL 对象，输出无尾斜杠 canonical。
  - `localizedAlternates()` 对内容页保留相对 canonical 和 hreflang，避免跨语言 alternate 被解析为当前页面。
  - `rootHomePageMetadata()` 的 canonical 使用显式 URL 对象，保持根首页 canonical 不变。
- `apps/passport-web/next.config.mjs`
  - 新增 `trailingSlash: false`，显式声明无尾斜杠 URL 策略。