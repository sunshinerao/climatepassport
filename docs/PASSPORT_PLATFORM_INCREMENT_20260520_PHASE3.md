# Passport Platform Increment 2026-05-20 (Phase 3)

## 需求解读

- 用户明确要求当前阶段聚焦 Climate Passport 主线开发，优先把 Passport 做成可验证、可运行的功能闭环。
- SHCW 壳站与 Passport 的对接属于下一步，不应占用本轮实现范围。
- 结合当前代码状态，Learning Experiences 是最关键的闭环缺口：用户侧缺少可操作工作台，管理员侧缺少申请审核状态流转闭环。

## 修改方法

- 采用最小增量方式扩展现有 `passport-web`：不重构既有模块，只在现有 LE API 和 dashboard/admin 结构上补足缺失链路。
- 用户侧实现 `创建申请 -> 保存草稿 -> 提交申请 -> 状态可见` 全流程，并在 dashboard 增加 LE 入口。
- 管理员侧实现 `申请列表 -> 状态流转 -> 参与记录联动`，并嵌入已有 LE admin 页面，避免分裂入口。
- 使用 `next build` 作为编译与类型回归门槛，确保改动可发布。

## 修改内容

### 1. 用户 LE 闭环

- 新增用户申请详情与草稿更新 API：
  - `apps/passport-web/app/api/learning-experiences/applications/[id]/route.ts`
- 新增用户提交申请 API：
  - `apps/passport-web/app/api/learning-experiences/applications/[id]/submit/route.ts`
- 新增用户 LE 工作台组件：
  - `apps/passport-web/components/learning-experiences-dashboard.tsx`
- 新增本地化 dashboard 页面与非本地化重定向：
  - `apps/passport-web/app/[locale]/dashboard/learning-experiences/page.tsx`
  - `apps/passport-web/app/dashboard/learning-experiences/page.tsx`
- 在 dashboard 首页增加 LE 快速入口：
  - `apps/passport-web/app/[locale]/dashboard/page.tsx`

### 2. 管理员 LE 审核闭环

- 新增管理员申请列表 API：
  - `apps/passport-web/app/api/admin/learning-experiences/applications/route.ts`
- 新增管理员申请状态流转 API：
  - `apps/passport-web/app/api/admin/learning-experiences/applications/[id]/status/route.ts`
- 新增管理员申请管理组件：
  - `apps/passport-web/components/admin-learning-applications-manager.tsx`
- 将申请审核面板嵌入现有 LE admin 页面：
  - `apps/passport-web/app/[locale]/admin/learning-experiences/page.tsx`
- 新增兼容重定向路由：
  - `apps/passport-web/app/[locale]/admin/learning-experiences/applications/page.tsx`
  - `apps/passport-web/app/admin/learning-experiences/applications/page.tsx`

### 3. 生命周期联动逻辑

- 管理员状态流转加入合法迁移约束，避免非法跳转。
- 在关键状态自动同步 `LearningExperienceParticipation`：
  - `ACCEPTED` 创建或更新为 `ADMITTED`
  - `ENROLLED` 更新为 `ACTIVE`
  - `COMPLETED` 更新为 `COMPLETED` 并写入完成时间与进度
  - `WITHDRAWN` 同步参与状态为 `WITHDRAWN`

### 4. 构建验证

- 已执行：`npm run build --workspace passport-web`
- 结果：通过（Next.js 构建、类型检查、路由生成全部成功）

### 5. Tracker 同步

- 更新 `docs/LEARNING_EXPERIENCES_PENDING_FEATURES_TRACKER.md`
- 更新 `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
