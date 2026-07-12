# AI Entity SEO Discoverability P0/P2 Changes (2026-07-12)

## 需求解读

本次变更目标是在不修改当前视觉设计、页面布局和业务功能的前提下，完成 Climate Passport 的 P0 与 P2 级机器可发现性增强：修复多语言页面 canonical 策略，更新 AI 发现入口，并补充保守、可验证的结构化数据，帮助搜索引擎与 AI crawler 更准确识别平台实体、站点结构、关于页和真实公开活动。

## 修改方法

1. 将 localized canonical 从固定指向英文页调整为各语言页面自 canonical，同时保留 hreflang 与 x-default。
2. 将 `llms.txt` 的 Home 入口调整为根域名，匹配当前根路径 200 与 canonical 策略。
3. 在既有全局 JSON-LD 上补充稳定 `@id`，并建立 Organization、WebSite、SoftwareApplication 的实体关联。
4. 增加保守的 DefinedTermSet、AboutPage、BreadcrumbList 和 Event JSON-LD，不引入页面上没有支撑的夸大声明。
5. 保持 private/auth/admin/dashboard/profile 的 noindex 与 robots 屏蔽策略不变。

## 修改内容

- `apps/passport-web/lib/seo.ts`
  - `localizedAlternates` 改为按当前 locale 生成 self-canonical。
  - 新增稳定实体 ID：Organization、WebSite、SoftwareApplication、DefinedTermSet。
  - 新增 AboutPage、BreadcrumbList、Event JSON-LD helper。
- `apps/passport-web/app/layout.tsx`
  - 全局 JSON-LD 增加 DefinedTermSet，并让站点级实体具备稳定关联。
- `apps/passport-web/app/[locale]/layout.tsx`
  - 对公开 localized 路径输出 BreadcrumbList JSON-LD，私有路径不输出。
- `apps/passport-web/app/[locale]/about/page.tsx`
  - 输出 AboutPage JSON-LD。
- `apps/passport-web/app/[locale]/activities/[slug]/page.tsx`
  - 对真实公开 EVENT 类型活动输出 Event JSON-LD。
- `apps/passport-web/app/llms.txt/route.ts`
  - Home 入口从 `/en` 调整为根路径 `/`。