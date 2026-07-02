# SEO Robots and Sitemap Change (2026-07-02)

## 需求解读

应用上线后还不能被 AI 或搜索引擎稳定抓取，检查发现项目缺少 `robots.txt` 和 `sitemap.xml`。这两个文件不是唯一可能原因，但它们是搜索引擎发现和理解站点结构的基础入口。本次进一步补齐 SEO/GEO 基线，适配 Vercel + Cloudflare 线上部署组合：

- `robots.txt` 用于告诉搜索引擎哪些路径允许或不允许抓取，并声明 sitemap 地址。
- `sitemap.xml` 用于列出公开页面 URL，帮助搜索引擎更快发现多语言页面。
- `llms.txt` 为 AI 搜索、RAG 和生成式搜索提供简明站点入口说明。
- 页面级 metadata、hreflang、Open Graph、Twitter metadata 和 JSON-LD 帮助搜索引擎及 AI 正确理解站点实体、语言版本、页面主题和可信来源。
- 对需要登录的页面、后台、API、用户资料等路径，应明确排除，避免无意义抓取或暴露非公开入口。

## 修改方法

1. 使用 Next.js App Router 原生 metadata route 实现 `robots.txt` 和 `sitemap.xml`。
2. 以 `NEXT_PUBLIC_SITE_URL` 作为站点根地址，默认回退到 `https://climatepass.org`。
3. sitemap 仅收录公开页面，不收录 auth、admin、dashboard、api、profile 等受保护或非公开页面。
4. sitemap 动态读取公开活动详情页；数据库不可用时回退到基础公开页面，避免部署构建被数据库连接阻断。
5. 在根布局中设置 `metadataBase`、全局 metadata 和 JSON-LD，确保 canonical、open graph、sitemap 等绝对 URL 生成稳定。
6. 为公开页面补充页面级 metadata、hreflang alternate、Open Graph、Twitter metadata 和 crawler 友好的 robots 指令。
7. 为 auth、admin、dashboard、verifier 等私有区域补充 `noindex,nofollow` metadata。
8. 新增 `/llms.txt`，为 AI/GEO 抓取提供站点摘要、公开入口和禁止使用的私有范围说明。
9. 在 `.env.example` 中补充 `NEXT_PUBLIC_SITE_URL`，提醒线上环境配置正式域名。

## 修改内容

- 新增 `apps/passport-web/app/robots.ts`
  - 生成 `/robots.txt`。
  - 默认允许公开页面抓取。
  - 排除：
    - `/api/`
    - `/admin/`
    - `/auth/`
    - `/dashboard/`
    - `/profile/`
    - 多语言下对应的 `/en/*`、`/zh/*`、`/fr/*`、`/de/*` 受保护路径。
  - 声明 sitemap 地址：`https://climatepass.org/sitemap.xml`（或 `NEXT_PUBLIC_SITE_URL` 对应域名）。

- 新增 `apps/passport-web/app/sitemap.ts`
  - 生成 `/sitemap.xml`。
  - 覆盖当前支持语言：`en`、`zh`、`fr`、`de`。
  - 动态收录公开活动详情页：`/{locale}/activities/{slug}`。
  - 数据库不可用或查询失败时，仍返回基础公开页面 sitemap。
  - 收录公开页面：
    - home
    - about
    - activities
    - certificates
    - contact
    - events
    - faq
    - privacy
    - speakers
    - terms

- 新增 `apps/passport-web/app/llms.txt/route.ts`
  - 生成 `/llms.txt`。
  - 提供站点摘要、主要公开页面、多语言入口、sitemap/robots 地址。
  - 明确 AI/GEO 可使用公开产品页、活动页、证书信息页、FAQ 和政策页作为公开来源。
  - 明确不得将账号、后台、dashboard、auth、API、profile 或 tokenized verification 页面作为公开来源。

- 新增 `apps/passport-web/lib/seo.ts`
  - 集中管理站点 URL、默认标题/描述、语言 tag、canonical/hreflang、公开页面 metadata、私有页面 noindex、JSON-LD 结构化数据。

- 修改 `apps/passport-web/app/layout.tsx`
  - 新增 `metadataBase`，默认使用 `https://climatepass.org`。
  - 新增全局 title template、description、Open Graph、Twitter metadata、robots、Organization/WebSite/SoftwareApplication JSON-LD。

- 修改公开页面 metadata
  - `apps/passport-web/app/[locale]/page.tsx`
  - `apps/passport-web/app/[locale]/about/page.tsx`
  - `apps/passport-web/app/[locale]/activities/page.tsx`
  - `apps/passport-web/app/[locale]/certificates/page.tsx`
  - `apps/passport-web/app/[locale]/contact/page.tsx`
  - `apps/passport-web/app/[locale]/events/page.tsx`
  - `apps/passport-web/app/[locale]/faq/page.tsx`
  - `apps/passport-web/app/[locale]/privacy/page.tsx`
  - `apps/passport-web/app/[locale]/speakers/page.tsx`
  - `apps/passport-web/app/[locale]/terms/page.tsx`

- 新增或修改私有页面 noindex
  - `apps/passport-web/app/[locale]/auth/layout.tsx`
  - `apps/passport-web/app/[locale]/dashboard/layout.tsx`
  - `apps/passport-web/app/[locale]/admin/layout.tsx`
  - `apps/passport-web/app/[locale]/verifier/page.tsx`
  - `apps/passport-web/app/auth/layout.tsx`
  - `apps/passport-web/app/dashboard/layout.tsx`
  - `apps/passport-web/app/admin/layout.tsx`

- 修改 `.env.example`
  - 新增：`NEXT_PUBLIC_SITE_URL="https://climatepass.org"`

## 验证结果

- `npx tsc -p apps/passport-web/tsconfig.json --noEmit --skipLibCheck` 通过。
- `npm run build --workspace passport-web` 通过。
- 生产构建路由表确认：
  - `/robots.txt`
  - `/sitemap.xml`
  - `/llms.txt`

## 后续注意

- 缺少 robots/sitemap 是影响抓取的重要原因，但不是唯一原因。上线后还需要确认：
  - 线上没有 `noindex` header 或 meta。
  - Vercel 项目没有启用密码保护或 preview protection。
  - 页面返回 200，而不是重定向循环、401、403、500。
  - Cloudflare、WAF 或中间件没有拦截搜索引擎 User-Agent。
  - Google Search Console / Bing Webmaster Tools 已提交 sitemap。
- Vercel 环境变量需设置：`NEXT_PUBLIC_SITE_URL=https://climatepass.org`。
- Cloudflare 建议检查：
  - WAF/Bot Fight Mode 不应挑战 Googlebot、Bingbot、OpenAI、Perplexity、ClaudeBot 等合法 crawler。
  - 不要对 `/robots.txt`、`/sitemap.xml`、`/llms.txt`、公开页面启用需要 JS Challenge 的规则。
  - 可对 sitemap/robots/llms 使用缓存，但不要返回旧的 `Disallow: /` 或错误域名。
  - 如使用 Page Rules/Redirect Rules，确认 `http -> https`、apex/www 跳转只有一跳且最终落到 canonical 域名。
- Google Search Console / Bing Webmaster Tools / 站长平台提交：`https://climatepass.org/sitemap.xml`。
- 如果后续要把证书验证详情页加入 sitemap，应先确认哪些验证 URL 是可公开长期索引的稳定页面，避免把个人 token 或隐私信息暴露给搜索引擎。
