# Passport Web Runnable System 2026-05-20

## 需求解读

- 用户要求继续推进 Climate Passport 的独立平台化，不只停留在展示壳，而是组装成一个可以注册、登录、查看个人数据、并支持不同角色进入前后台的可运行系统。
- 当前优先级是把 `passport-web` 从静态演示页推进到最小可运行产品闭环：真实会话、受保护 dashboard、角色化 admin、活动管理、正式消息/通知读取。
- 同时需要保持变更最小化，避免破坏已经验证过的 Speakers、Events、Info 页面与 Prisma 数据基线。

## 修改方法

- 以 Prisma 现有 `User` / `Session` / `Notification` / `ContactMessage` / `Event` 模型为中心，不引入额外鉴权框架，直接实现轻量 session-cookie 方案。
- 采用分层补齐：先补 `app/api/auth/*` 与服务端 auth helper，再把登录态接入站点 shell 和受保护页面，最后补角色化后台活动管理与用户态 dashboard。
- 消息与通知页面从原先的派生数据展示切换为优先读取当前登录用户的正式持久化模型，保留 fallback 以降低回归风险。
- 本次修改完成后使用 `npm run build --workspace passport-web` 与本地 dev server + `curl` 进行真实烟测，验证注册、登录、dashboard、admin 角色门禁与活动创建链路。

## 修改内容

- 新增真实认证与会话能力：
  - `apps/passport-web/lib/server/auth.ts`
  - `apps/passport-web/app/api/auth/login/route.ts`
  - `apps/passport-web/app/api/auth/register/route.ts`
  - `apps/passport-web/app/api/auth/logout/route.ts`
  - `apps/passport-web/app/api/auth/session/route.ts`
- 新增客户端认证与退出组件：
  - `apps/passport-web/components/auth-form.tsx`
  - `apps/passport-web/components/logout-button.tsx`
- 让全站 shell 识别当前登录用户，在 header 中切换登录/注册、工作台、后台、退出入口：
  - `apps/passport-web/components/site-shell.tsx`
- 让以下页面基于真实 session/role 运行：
  - `apps/passport-web/app/[locale]/dashboard/page.tsx`
  - `apps/passport-web/app/[locale]/admin/page.tsx`
  - `apps/passport-web/app/[locale]/admin/events/page.tsx`
  - 以及对应的非 locale redirect routes
- 新增后台活动管理 API 与前端管理台：
  - `apps/passport-web/lib/server/admin-events.ts`
  - `apps/passport-web/app/api/admin/events/route.ts`
  - `apps/passport-web/app/api/admin/events/[id]/route.ts`
  - `apps/passport-web/components/admin-events-manager.tsx`
- 把以下页面从静态表单/静态用户切换为真实登录态：
  - `apps/passport-web/components/platform-screens.tsx`
  - `apps/passport-web/app/[locale]/auth/login/page.tsx`
  - `apps/passport-web/app/[locale]/auth/register/page.tsx`
  - `apps/passport-web/lib/server/platform-data.ts`
- 为角色验证补充 seeded `EVENT_MANAGER` 用户，并把 notifications/contact seed 扩展到真实消息模型：
  - `prisma/seed.mjs`
- 为 header、admin form、状态提示补最少样式支持：
  - `apps/passport-web/app/globals.css`
- 更新平台总 tracker：
  - `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`

## 验证结果

- `DATABASE_URL='postgresql://rr@localhost:5432/climate_passport' npm run db:validate`
- `DATABASE_URL='postgresql://rr@localhost:5432/climate_passport' npm run db:generate`
- `DATABASE_URL='postgresql://rr@localhost:5432/climate_passport' prisma db push`
- `DATABASE_URL='postgresql://rr@localhost:5432/climate_passport' npm run db:seed`
- `DATABASE_URL='postgresql://rr@localhost:5432/climate_passport' npm run build --workspace passport-web`
- 本地 `PORT=3100 npm run dev` 烟测通过：
  - 新用户注册成功并进入 `/en/dashboard/climate-passport`
  - 新用户访问 `/en/dashboard` 返回真实欢迎内容
  - 普通 attendee 访问 `/en/admin/events` 返回 `307`
  - `ops.admin@climatepass.org / seeded-password` 可进入 `/en/admin/events`
  - admin 通过 `/api/admin/events` 成功创建活动，日期序列化已校正为上海时区自然日
