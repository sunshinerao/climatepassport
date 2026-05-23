# Passport Platform 增量开发记录（2026-05-20 Phase 2）

## 需求解读

- 用户明确要求继续推进 1、2、3：
  - 1）补齐 notifications/messages 的可操作能力，不仅仅是读取。
  - 2）继续推进 SHCW shell 与 Climate Passport 的 session bridge。
  - 3）把 Learning Experiences 从文档结论推进到 schema/API/后台可运行层。
- 变更必须遵循已完成 runnable system 的基础，不回退现有 auth、role gate 与 admin events 功能。

## 修改方法

- 通知与消息：新增 dashboard 侧 mutation API，并在现有页面嵌入可提交表单。
- Channel bridge：在已有 Passport session 体系上新增一次性 bridge token 机制（签发 + 兑换），避免引入第二套长期会话源。
- Learning Experiences：
  - 在 Prisma 中新增 Program/Application/Stage/Participation/EventLink 目标模型。
  - 补 admin programs API（list/create/patch）与 public APIs（program list/application create）。
  - 新增 admin 页面作为第一批可运行后台入口。
- 完成后执行 `prisma generate`、`prisma db push`、`db:seed`、`passport-web build`，并做 runtime smoke。

## 修改内容

### 一、通知与消息可操作能力

- 新增 API：
  - `apps/passport-web/app/api/dashboard/notifications/preferences/route.ts`
  - `apps/passport-web/app/api/dashboard/notifications/[id]/route.ts`
  - `apps/passport-web/app/api/dashboard/messages/contact/route.ts`
- 新增组件：
  - `apps/passport-web/components/notification-preferences-form.tsx`
  - `apps/passport-web/components/contact-message-form.tsx`
- 页面接入：
  - 更新 `apps/passport-web/components/platform-screens.tsx`

### 二、SHCW shell session bridge（最小可运行版）

- 鉴权层扩展：
  - 更新 `apps/passport-web/lib/server/auth.ts`
  - 新增 bridge token 的签发与兑换方法：`issueChannelBridgeToken`、`exchangeChannelBridgeToken`
- 新增 API：
  - `apps/passport-web/app/api/channel/session/bridge/route.ts`
  - `apps/passport-web/app/api/channel/session/exchange/route.ts`
- 数据模型支持：
  - 更新 `prisma/schema.prisma`，新增 `ChannelSessionBridge`

### 三、Learning Experiences schema/API/后台落地

- Prisma 模型新增：
  - `LearningExperienceCategory`
  - `LearningExperienceProgram`
  - `LearningExperienceStage`
  - `LearningExperienceApplication`
  - `LearningExperienceParticipation`
  - `LearningExperienceProgramEventLink`
- API 与服务：
  - 新增 `apps/passport-web/lib/server/admin-learning-experiences.ts`
  - 新增 `apps/passport-web/app/api/admin/learning-experiences/programs/route.ts`
  - 新增 `apps/passport-web/app/api/admin/learning-experiences/programs/[id]/route.ts`
  - 新增 `apps/passport-web/app/api/learning-experiences/programs/route.ts`
  - 新增 `apps/passport-web/app/api/learning-experiences/applications/route.ts`
- 管理页面：
  - 新增 `apps/passport-web/components/admin-learning-programs-manager.tsx`
  - 新增 `apps/passport-web/app/[locale]/admin/learning-experiences/page.tsx`
  - 新增 `apps/passport-web/app/admin/learning-experiences/page.tsx`
  - 更新 `apps/passport-web/app/[locale]/admin/page.tsx`
- Seed 扩展：
  - 更新 `prisma/seed.mjs`，补 LE category/program/stage/application/participation/event-link 基线数据

### 四、验证结果

- `npm run db:generate`：通过
- `npx prisma db push --schema prisma/schema.prisma`：通过
- `npm run db:seed`：通过（含 LE baseline 计数）
- `npm run build --workspace passport-web`：通过
- Runtime smoke：
  - attendee 注册成功
  - 通知偏好 PATCH 成功
  - 联系消息 POST 成功
  - bridge token 签发/兑换成功
  - LE public API 200
  - admin 登录后 LE admin 页面/API 200
  - attendee 访问 LE admin 返回 307（角色门禁正常）
