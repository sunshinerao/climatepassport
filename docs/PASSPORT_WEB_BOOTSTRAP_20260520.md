# Passport Web 基础框架启动记录

## 需求解读

- 需要把新的 Climate Passport 仓库继续推进到“可运行、可验证”的程度，而不是只有架构文档。
- 当前阶段需要先建立 `passport-web` 的基础框架和核心验证页面，让产品和架构方向可以被直接打开验证。
- 迁移原则仍然成立：成熟的用户、Passport、活动、Verifier 逻辑和 UI 是保留迁移对象，因此本次基础框架需要围绕这些核心能力进行页面落点，而不是偏离到其他内容层。

## 修改方法

- 在 `apps/passport-web` 下搭建最小可运行的 Next.js App Router 应用。
- 增加全局样式、公共站点外壳和一组稳定 mock 数据，先让页面和信息架构可验证。
- 提供平台首页、Passport 页面、Certificate Hub 页面、Events 页面，以及基础 auth 页面作为第一批核心验证入口。

## 修改内容

- 新增 `apps/passport-web/package.json`
- 新增 `apps/passport-web/tsconfig.json`
- 新增 `apps/passport-web/next.config.mjs`
- 新增 `apps/passport-web/next-env.d.ts`
- 新增 `apps/passport-web/app/globals.css`
- 新增 `apps/passport-web/app/layout.tsx`
- 新增 `apps/passport-web/app/page.tsx`
- 新增 `apps/passport-web/app/dashboard/climate-passport/page.tsx`
- 新增 `apps/passport-web/app/certificates/page.tsx`
- 新增 `apps/passport-web/app/events/page.tsx`
- 新增 `apps/passport-web/app/auth/login/page.tsx`
- 新增 `apps/passport-web/app/auth/register/page.tsx`
- 新增 `apps/passport-web/components/site-shell.tsx`
- 新增 `apps/passport-web/lib/mock-data.ts`
- 新增 `docs/PASSPORT_WEB_BOOTSTRAP_20260520.md`