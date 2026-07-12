# Climate Records and Credentials Knowledge Hub Change

## 需求解读

- 创建一个单一公开英文知识页 `/en/climate-records-and-credentials`，集中解释 climate records、credentials、verification、participation、action records 和 climate digital identity。
- 页面需要服务 SEO/GEO/AI search，但不能制造未翻译页面的 hreflang 或 sitemap URL。
- 页面必须保留 Climate Passport 的身份边界，不声称政府身份、旅行证件、UN 身份、通用互操作、区块链背书、雇主信任或自动碳减排/气候影响验证。

## 修改方法

- 新增独立 Knowledge Hub 组件，沿用现有公共信息页的 `section-header`、`panel` 和 `privacy-policy-section` 视觉体系。
- 在 `[locale]` 路由下实现英文-only 页面：非 `en` locale 直接 `notFound()`，metadata 仅声明英文 canonical 和 x-default。
- 在 sitemap 中单独注入英文 URL，不加入全 locale publicRoutes，避免生成不存在的 zh/fr/de 版本。
- 在 `/en/about` 的 verifiable credentials 小节加入自然内部链接。
- 添加 WebPage 与 BreadcrumbList JSON-LD，并引用站点 Organization `@id`。

## 修改内容

- 新增 `apps/passport-web/components/climate-records-credentials-screen.tsx`，包含 H1、目录锚点、核心定义、身份边界、相关概念和内部链接。
- 新增 `apps/passport-web/app/[locale]/climate-records-and-credentials/page.tsx`，提供页面 metadata、英文-only 访问控制和结构化数据。
- 更新 `apps/passport-web/lib/seo.ts`，增加 Knowledge Hub WebPage JSON-LD helper 与 breadcrumb label。
- 更新 `apps/passport-web/app/sitemap.ts`，加入 `/en/climate-records-and-credentials` 英文-only sitemap 条目。
- 更新 `apps/passport-web/components/about-entity-screen.tsx`，加入从 `/en/about` 到 Knowledge Hub 的可见内链。
- 更新 `apps/passport-web/app/globals.css`，补充 Knowledge Hub 目录和正文标题的轻量样式。