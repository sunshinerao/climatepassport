# Root Domain Verification Redirect Fix (2026-07-02)

## 需求解读

部分域名验证程序要求用户提交的 URL 原样返回 200，不能跳转到其他路径。当前访问 `www.climatepass.org` 时存在两类问题：根路径会从 `/` 跳到 `/en`，同时线上域名层出现 `www` 与 apex 互相跳转，导致验证程序提示 `Domain couldn't be verified. The URL you entered redirected somewhere else.`。

## 修改方法

1. 应用层取消根路径 `/` 到 `/en` 的跳转，让 `/` 直接渲染英文首页并返回 200。
2. 将默认站点 canonical URL 调整为 `https://www.climatepass.org`，使 metadata、robots、sitemap、llms 默认域名与当前 Vercel 最终服务域保持一致。
3. 保留 `/en`、`/zh` 等语言入口，用户仍可通过导航或明确 URL 访问对应语言页面。
4. 域名层需要在 Cloudflare/Vercel 中统一 canonical 域名，避免 `www -> apex` 与 `apex -> www` 同时存在。

## 修改内容

- `apps/passport-web/app/page.tsx`
  - 移除 `redirect("/en")`。
  - 直接渲染 `HomeScreen locale="en"`。
  - 为根路径补充专用英文首页 metadata，使 canonical 指向 `https://www.climatepass.org/`。
- `apps/passport-web/lib/seo.ts`
  - 默认 `siteUrl` 从 `https://climatepass.org` 调整为 `https://www.climatepass.org`。
  - 新增根首页 metadata helper，避免 `/` 的 canonical 继续指向 `/en/`。
- `apps/passport-web/app/robots.ts`
  - 默认 host/sitemap 域名调整为 `https://www.climatepass.org`。
- `apps/passport-web/app/sitemap.ts`
  - 默认 sitemap URL 域名调整为 `https://www.climatepass.org`。
  - 将根路径 `https://www.climatepass.org/` 加入 sitemap，匹配根路径 canonical。
- `.env.example`
  - `NEXT_PUBLIC_SITE_URL` 示例调整为 `https://www.climatepass.org`。

## 运维注意

Cloudflare 与 Vercel 只能保留一个 canonical 方向。当前建议使用 `www.climatepass.org` 作为 canonical：

- 保留或设置 `climatepass.org -> https://www.climatepass.org`。
- 删除/关闭 `www.climatepass.org -> https://climatepass.org`。
- Vercel 环境变量设置 `NEXT_PUBLIC_SITE_URL=https://www.climatepass.org`。
- 域名验证时优先提交 `https://www.climatepass.org/`，修复部署后该 URL 应返回 200，不再跳到 `/en`。