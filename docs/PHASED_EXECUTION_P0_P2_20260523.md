# P0-P2 阶段执行报告（2026-05-23）

## 需求解读
- 目标是按阶段完成 P0-P2：
  - P0：先消除阻塞风险并修复关键行为不一致。
  - P1：推进可用性和模块开发，提升后台可发现性与证书模块可运行度。
  - P2：补最小测试脚手架，形成可持续回归起点。
- 每个阶段都需要执行基础测试。
- 每个阶段都需要把已完成与未完成项记录到文档。

## 修改方法
1. 先处理会影响发布的构建阻塞与业务行为偏差（P0）。
2. 在不破坏现有路由和角色权限边界的前提下补后台模块间导航（P1）。
3. 把易变业务逻辑抽离为可测试 helper，并补回归测试（P2）。
4. 每阶段完成后执行基础测试（`npm test`、`npm run lint`、`npm run build` 或必要子集）。
5. 同步更新平台总跟踪文档与实现状态文档，标注 done/doing/todo。

## 修改内容

### P0（已完成）
- 修复构建阻塞：
  - 文件：`apps/passport-web/app/[locale]/admin/certificates/rules/page.tsx`
  - 内容：将 `learningExperiencePrograms` 的错误字段选择从 `name/nameEn` 修正为 `title/titleEn`，恢复类型与 Prisma schema 一致性。
- 修复夏校重复申请查重逻辑：
  - 文件：`apps/passport-web/app/api/summer-school/application-lookup/route.ts`
  - 内容：将查重条件从“邮箱+Passport ID 必须同时存在”调整为“邮箱或 Passport ID 任一命中即可查询”。

基础测试结果（P0）：
- `npm test`：通过
- `npm run lint`：通过
- `npm run build`：通过

P0 未完成项：
- 无。

### P1（已完成）
- 后台跨模块导航增强（提升菜单可发现性）：
  - 文件：`apps/passport-web/app/[locale]/admin/events/page.tsx`
  - 文件：`apps/passport-web/app/[locale]/admin/learning-experiences/page.tsx`
  - 内容：新增 Admin quick links 面板，统一提供 Dashboard / Events / Learning Experiences / Summer School Apps / Certificate Hub 的跨模块入口（后两项受角色限制）。

基础测试结果（P1）：
- `npm run lint`：通过
- `npm run build`：通过

P1 未完成项：
- 证书模块更深层运营能力仍在 doing：筛选/搜索深度、批量流程、部分持久化交互（例如公开展示开关持久化）尚未完全闭环。

### P2（已完成当前计划）
- 抽离可测试逻辑：
  - 新增文件：`apps/passport-web/lib/server/summer-school-lookup.ts`
  - 能力：`isValidApplicationLookupEmail`、`buildSummerSchoolLookupOrFilters`
- 路由改造复用 helper：
  - 文件：`apps/passport-web/app/api/summer-school/application-lookup/route.ts`
- 新增回归测试：
  - 新增文件：`tests/summer-school-lookup.test.mjs`
  - 覆盖：邮箱合法性、email-only、passport-only、email+passport、无效输入分支。

基础测试结果（P2）：
- `npm test`：通过（16/16）

P2 未完成项：
- API 权限边界与证书全生命周期（issue/verify/download/revoke/restore）的自动化回归仍需继续补齐。

### P2（继续推进，已完成）
- 新增证书公开验证序列化回归测试：
  - 新增文件：`tests/certificate-verification-serialization.test.mjs`
  - 覆盖：
    - `allocateCertificateVerificationCode` 碰撞重试；
    - `serializePublicCertificateVerification` 在 `ISSUED/REVOKED/其他状态` 下的结果映射；
    - 最小披露边界（不返回 email/phone/adminNotes 等敏感字段）。

基础测试结果（P2 继续阶段）：
- `npm test`：通过（20/20）
- `npm run lint`：通过
- `npm run build`：通过

## 阶段状态总览
- P0：Done
- P1：Done（首阶段目标）
- P2：Doing（已完成 helper 级回归，API/E2E 级回归继续推进）
- P2：Doing（helper 与序列化回归已增强；API 权限边界与证书生命周期 E2E 仍待补齐）
