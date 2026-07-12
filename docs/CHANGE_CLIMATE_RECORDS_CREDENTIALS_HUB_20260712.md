# Climate Records and Credentials Knowledge Hub Change

## 需求解读

- 创建一个公开多语言知识页 `/[locale]/climate-records-and-credentials`，集中解释 climate records、credentials、verification、participation、action records 和 climate digital identity。
- 页面需要服务 SEO/GEO/AI search，并像 About、Privacy 等公共信息页一样提供 en/zh/fr/de 的 canonical、hreflang 和 sitemap URL。
- 页面必须保留 Climate Passport 的身份边界，不声称政府身份、旅行证件、UN 身份、通用互操作、区块链背书、雇主信任或自动碳减排/气候影响验证。

## 修改方法

- 新增独立 Knowledge Hub 组件，沿用现有公共信息页的 `section-header`、`panel` 和 `privacy-policy-section` 视觉体系，并通过 locale 内容字典渲染四语文案。
- 在 `[locale]` 路由下实现 en/zh/fr/de 多语言页面，metadata 跟随当前 locale 生成 canonical、Open Graph language 和 hreflang alternates。
- 将 `/climate-records-and-credentials` 纳入 sitemap 常规 publicRoutes，使四个 locale URL 都进入 sitemap，并互相声明 alternates。
- 在 `/en/about` 的 verifiable credentials 小节加入自然内部链接。
- 添加 WebPage 与 BreadcrumbList JSON-LD，并引用站点 Organization `@id`。

## 修改内容

- 新增 `apps/passport-web/components/climate-records-credentials-screen.tsx`，包含四语 H1、目录锚点、核心定义、身份边界、相关概念和 locale-aware 内部链接。
- 新增 `apps/passport-web/app/[locale]/climate-records-and-credentials/page.tsx`，提供多语言 metadata、结构化数据和页面渲染。
- 新增 `apps/passport-web/app/climate-records-and-credentials/page.tsx`，将未加语言前缀的访问路径重定向到英文 canonical 页面 `/en/climate-records-and-credentials`。
- 更新 `apps/passport-web/lib/seo.ts`，增加支持 locale/name/description 的 Knowledge Hub WebPage JSON-LD helper 与 breadcrumb label。
- 更新 `apps/passport-web/app/sitemap.ts`，将 `/climate-records-and-credentials` 加入常规多语言 publicRoutes。
- 更新 `apps/passport-web/components/about-entity-screen.tsx`，加入从 `/en/about` 到 Knowledge Hub 的可见内链。
- 更新 `apps/passport-web/app/globals.css`，补充 Knowledge Hub 目录和正文标题的轻量样式。