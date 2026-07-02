# Auth Email Progress Review (2026-06-30)

## 需求解读

本文件用于记录 2026-06-08 前后完成的认证邮件功能进展，重点回顾 Climate Passport 平台新增的邮箱验证、忘记密码、重置密码、Resend 实发联调与本地验收结果，便于后续继续开发时快速恢复上下文。

本次邮件功能采用“方案 A”：新增独立认证邮件 token 表，统一承载邮箱验证与密码重置，不再依赖 `User.resetToken` 单字段作为主流程。

## 修改方法

1. 数据层新增 `AuthEmailTokenPurpose` 枚举与 `AuthEmailToken` 模型。
2. 服务层新增 Resend 邮件发送封装和认证邮件 token 服务。
3. 接口层改造注册、登录流程，并新增 verify-email、forgot-password、reset-password API。
4. 页面层新增邮箱验证、忘记密码、重置密码页面和客户端表单。
5. 本地完成 Prisma 迁移、类型检查、测试回归与真实邮件收发验证。

## 修改内容

### 数据模型与迁移

- `prisma/schema.prisma`
  - 新增 `AuthEmailTokenPurpose`：
    - `VERIFY_EMAIL`
    - `RESET_PASSWORD`
  - 新增 `AuthEmailToken`：
    - `userId`
    - `email`
    - `purpose`
    - `tokenHash`
    - `code`
    - `expiresAt`
    - `consumedAt`
    - `attempts`
    - `createdAt`
  - `User` 新增关系字段：`authEmailTokens AuthEmailToken[]`

- `prisma/migrations/20260608103000_auth_email_tokens/migration.sql`
  - 创建 enum、表、索引、外键。
  - 回填历史 `ACTIVE` 用户的 `emailVerified`，避免老用户被新登录逻辑拦截。

### 邮件服务

- `apps/passport-web/lib/server/mailer.ts`
  - 使用 `resend` 包发送事务邮件。
  - 读取环境变量：
    - `RESEND_API_KEY`
    - `MAIL_FROM`
  - `MAIL_FROM` 默认值：`Climate Passport <no-reply@notice.climatepass.org>`。

- `apps/passport-web/lib/server/auth-email.ts`
  - 生成 raw token。
  - 通过 SHA-256 存储 `tokenHash`。
  - 生成 6 位数字验证码。
  - 创建、查询、消费邮件 token。
  - 发送邮箱验证邮件与重置密码邮件。
  - 当前 token 默认有效期为 30 分钟。

### 注册与登录流程

- `apps/passport-web/app/api/auth/register/route.ts`
  - 注册后不再自动登录。
  - 新用户或 `PENDING` 临时用户注册后，创建 `VERIFY_EMAIL` token 并发送验证邮件。
  - 用户 `emailVerified` 初始为 `null`。
  - 返回验证页跳转地址。

- `apps/passport-web/app/api/auth/login/route.ts`
  - 登录前校验账号状态和密码。
  - 如果用户未验证邮箱：
    - 创建新的 `VERIFY_EMAIL` token。
    - 自动发送验证邮件。
    - 返回 `403`、`requiresVerification: true` 和验证页跳转地址。
  - 如果邮箱已验证，正常创建 session 并进入 dashboard。

### 邮箱验证流程

- `apps/passport-web/app/api/auth/verify-email/request/route.ts`
  - 支持手动重发验证邮件。

- `apps/passport-web/app/api/auth/verify-email/confirm/route.ts`
  - 支持两种验证方式：
    - 邮件链接 token。
    - email + 6 位验证码。
  - 验证成功后：
    - 消费 token。
    - 写入 `emailVerified`。
    - 保持用户 `status = ACTIVE`。
    - 创建登录 session。
    - 跳转 dashboard。

### 忘记密码与重置密码流程

- `apps/passport-web/app/api/auth/forgot-password/route.ts`
  - 对已存在、`ACTIVE` 且邮箱已验证的用户创建 `RESET_PASSWORD` token。
  - 发送重置密码邮件。
  - 为避免账号枚举，无论邮箱是否存在都返回通用成功消息。

- `apps/passport-web/app/api/auth/reset-password/route.ts`
  - 支持 token 或验证码重置。
  - 校验 token/email 匹配关系。
  - 用户必须为 `ACTIVE`。
  - 成功后更新密码 hash，并清空旧 `resetToken/resetTokenExpiry` 字段。

### 前端页面与表单

- `apps/passport-web/components/auth-form.tsx`
  - 登录表单新增：
    - 忘记密码入口。
    - 验证邮箱入口。
  - 支持处理 `requiresVerification` 响应并跳转验证页。

- `apps/passport-web/components/auth-email-forms.tsx`
  - 新增 `VerifyEmailForm`。
  - 新增 `ForgotPasswordForm`。
  - 新增 `ResetPasswordForm`。

- 新增本地化页面：
  - `apps/passport-web/app/[locale]/auth/verify-email/page.tsx`
  - `apps/passport-web/app/[locale]/auth/forgot-password/page.tsx`
  - `apps/passport-web/app/[locale]/auth/reset-password/page.tsx`

- 新增默认英文重定向页面：
  - `apps/passport-web/app/auth/verify-email/page.tsx`
  - `apps/passport-web/app/auth/forgot-password/page.tsx`
  - `apps/passport-web/app/auth/reset-password/page.tsx`

### 本地环境配置

本地 `.env` 已用于本地联调，关键配置包括：

```env
DATABASE_URL="postgresql://rr@localhost:5432/climatepassport"
DIRECT_URL="postgresql://rr@localhost:5432/climatepassport"
RESEND_API_KEY="本地配置，不在聊天中传递"
MAIL_FROM="Climate Passport <no-reply@notice.climatepass.org>"
```

注意：Resend API Key 属于敏感信息，只应在本地或部署环境变量中配置，不应通过聊天、文档或提交记录暴露。

### 本地迁移与验证记录

已执行并通过：

- `npm install`
- `npm run db:generate`
- `npm run db:migrate:deploy`
- `npm run db:migrate:status`
- `npx tsc -p apps/passport-web/tsconfig.json --noEmit --skipLibCheck`
- `npm test`

验证结果：

- 本地 Prisma 迁移成功。
- 数据库 schema up to date。
- TypeScript 检查通过。
- 测试 38/38 通过。

### 真实邮件验收记录

#### 忘记密码 / 重置密码

测试邮箱：`44247084@qq.com`

验收结果：

1. 忘记密码接口触发成功。
2. Resend 邮件真实送达。
3. 邮件验证码与数据库 `RESET_PASSWORD` token 记录一致。
4. 用户提交验证码后，`RESET_PASSWORD` token 被消费。
5. `POST /api/auth/reset-password` 返回 200。
6. 新密码登录成功。
7. 用户进入 `/zh/dashboard/climate-passport`。

结论：忘记密码、重置密码、重置后登录全链路已在本地真实验收通过。

#### 注册验证邮件

测试邮箱：`sunshine.rao@yahoo.com`

验收结果：

1. 注册接口触发成功。
2. Resend 验证邮件真实送达。
3. 数据库创建 `VERIFY_EMAIL` token。
4. 用户点击邮件链接或提交验证码后，`VERIFY_EMAIL` token 被消费。
5. 用户 `emailVerified` 成功写入。
6. 验证后登录成功。
7. 登录接口返回 `/en/dashboard/climate-passport`。

结论：注册验证邮件、验证邮箱、验证后登录全链路已在本地真实验收通过。

### 相关修复

测试过程中曾出现首页 runtime error：

```txt
TypeError: Cannot read properties of undefined (reading 'line1')
```

原因：`[locale]` 动态路由可能接收非法路径段，导致 `HomeScreen` 收到不受支持的 locale。

已在 `apps/passport-web/app/[locale]/page.tsx` 添加运行时 locale 校验：

- 使用 `isSupportedLocale` 判断。
- 非法 locale 直接 `notFound()`。
- 已验证 `/favicon.ico`、`/not-a-locale` 返回 404，不再触发 `HomeScreen` 崩溃。

### 重要操作约定

数据库迁移安全规则：

- 未明确要求“推送到远程”或“推送到 GitHub”时，只允许操作本地数据库。
- 只有用户明确要求推送远程/GitHub 时，才执行线上 Neon/Vercel 相关 `prisma migrate deploy`。
- 本地 `prisma migrate deploy` 当前连接本地 `DATABASE_URL`，不会影响远程 Neon。

## 后续建议

1. 为认证邮件 API 增加自动化测试：
   - 注册后生成验证 token。
   - 未验证登录返回 `requiresVerification`。
   - 邮箱验证成功后写入 `emailVerified`。
   - 忘记密码不泄露账号是否存在。
   - 重置密码消费 token。

2. 增强安全细节：
   - 实现 `attempts` 递增。
   - 对连续错误验证码做锁定或延迟。
   - 增加过期 token 清理脚本。

3. 优化产品体验：
   - 邮件模板中英文国际化。
   - 验证失败、过期、已消费场景文案细化。
   - 邮件发送失败时提供明确重试入口。

4. 上线前检查：
   - Vercel 环境变量是否包含 `RESEND_API_KEY`、`MAIL_FROM`。
   - Resend 发件域 `notice.climatepass.org` 是否已验证。
   - 推送远程/GitHub 时再执行线上 `prisma migrate deploy`。
