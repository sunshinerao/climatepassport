# Scheme A Auth Email Refactor (2026-06-08)

## 需求解读
- 按方案 A 改造认证流程：注册后必须进行邮箱验证，不再直接登录。
- 登录流程增加邮箱验证门禁：未验证用户不可直接登录，系统应支持自动重发/手动重发验证邮件。
- 引入基于独立 token 表的邮件动作机制，统一承载 `VERIFY_EMAIL` 与 `RESET_PASSWORD`。
- 新增忘记密码与重置密码的完整链路，支持邮件链接 token 与 6 位验证码两种输入方式。
- 兼容中英文路由与现有 Climate Passport 认证 UI 风格。

## 修改方法
- 数据层：在 Prisma 中扩展 `AuthEmailTokenPurpose` 枚举与 `AuthEmailToken` 模型，通过哈希 token + code 的方式存储一次性凭证。
- 服务层：新增邮件发送封装与认证邮件 token 服务，统一处理 token 生成、哈希、校验、消费及邮件模板发送。
- 接口层：重构 `register/login` 并新增 `verify-email/request`、`verify-email/confirm`、`forgot-password`、`reset-password` 接口。
- 页面层：新增本地化页面与表单组件，打通验证邮箱、忘记密码、重置密码三条用户路径。
- 兼容层：新增非本地化 auth 路由重定向到 `/en/...`，确保旧入口可用。

## 修改内容
- 数据与依赖：
  - `prisma/schema.prisma`：新增 `AuthEmailTokenPurpose` 与 `AuthEmailToken`，并挂接 `User.authEmailTokens`。
  - `prisma/migrations/20260608103000_auth_email_tokens/migration.sql`：创建新表/索引/枚举并补写历史 `emailVerified`。
  - `apps/passport-web/package.json`：新增 `resend` 依赖。
- 后端服务：
  - `apps/passport-web/lib/server/mailer.ts`：新增 Resend 发送封装，读取 `RESEND_API_KEY` 与 `MAIL_FROM`。
  - `apps/passport-web/lib/server/auth-email.ts`：新增 token 生成、哈希校验、按 token/code 消费、验证/重置邮件发送。
- 认证接口：
  - `apps/passport-web/app/api/auth/register/route.ts`：注册后改为发送验证邮件并跳转验证页，不再创建登录会话。
  - `apps/passport-web/app/api/auth/login/route.ts`：未验证邮箱时阻断登录并下发验证流程跳转。
  - `apps/passport-web/app/api/auth/verify-email/request/route.ts`：重发验证邮件。
  - `apps/passport-web/app/api/auth/verify-email/confirm/route.ts`：确认验证并创建会话。
  - `apps/passport-web/app/api/auth/forgot-password/route.ts`：发起找回密码。
  - `apps/passport-web/app/api/auth/reset-password/route.ts`：完成密码重置。
- 前端与路由：
  - `apps/passport-web/components/auth-form.tsx`：登录表单增加“忘记密码/验证邮箱”入口，并处理未验证登录的重定向响应。
  - `apps/passport-web/components/auth-email-forms.tsx`：新增验证邮箱、忘记密码、重置密码三个客户端表单。
  - `apps/passport-web/app/[locale]/auth/verify-email/page.tsx`：新增本地化验证页。
  - `apps/passport-web/app/[locale]/auth/forgot-password/page.tsx`：新增本地化忘记密码页。
  - `apps/passport-web/app/[locale]/auth/reset-password/page.tsx`：新增本地化重置密码页。
  - `apps/passport-web/app/auth/verify-email/page.tsx`：新增英文默认重定向。
  - `apps/passport-web/app/auth/forgot-password/page.tsx`：新增英文默认重定向。
  - `apps/passport-web/app/auth/reset-password/page.tsx`：新增英文默认重定向。
