# CHANGE_ACHIEVEMENT_BADGE_BLUEPRINT_DELIVERY_20260526

## 需求解读

本次需求是按既定蓝图一次性落地 Achievement + Badge 模块的可运行能力，覆盖数据层、服务层、API、页面、导航可达性与关键业务触发点，且中途不再分步确认。

## 修改方法

1. 先补齐后端能力：新增/完善 achievement-badge 服务、用户端 API、管理端 API、公开验证 API。
2. 再补齐页面能力：新增用户仪表盘成就与徽章页面、管理端成就与徽章页面、公开徽章验证页面。
3. 再打通入口：在 dashboard 快捷操作、账户菜单、admin shell 中加入导航。
4. 最后打通触发：在注册、资料维护、证书签发、验证员签到成功后写入成就，并触发徽章评估。
5. 提供 Prisma migration SQL，保证新表/新枚举可迁移。

## 修改内容

1. 新增/完善数据与服务
- 新增成就/徽章相关 Prisma schema 模型与枚举（已在 schema 中扩展）。
- 新增 migration: prisma/migrations/20260526120000_achievement_badge_system/migration.sql。
- 新增服务: apps/passport-web/lib/server/achievement-badge.ts。
- 在 createAchievementRecord 中增加 sourceType + sourceId 幂等去重，防止触发重复写入。

2. 新增 API
- 用户端：
  - apps/passport-web/app/api/me/achievements/route.ts
  - apps/passport-web/app/api/me/badges/route.ts
- 管理端：
  - apps/passport-web/app/api/admin/achievements/route.ts
  - apps/passport-web/app/api/admin/achievements/[id]/approve/route.ts
  - apps/passport-web/app/api/admin/achievements/[id]/reject/route.ts
  - apps/passport-web/app/api/admin/achievements/[id]/revoke/route.ts
  - apps/passport-web/app/api/admin/badge-definitions/route.ts
  - apps/passport-web/app/api/admin/badge-definitions/[id]/activate/route.ts
  - apps/passport-web/app/api/admin/badge-definitions/[id]/deactivate/route.ts
  - apps/passport-web/app/api/admin/badge-awards/route.ts
  - apps/passport-web/app/api/admin/badge-awards/[id]/revoke/route.ts
- 公开验证：
  - apps/passport-web/app/api/verify/badge/[token]/route.ts

3. 新增页面与客户端组件
- 用户页面：
  - apps/passport-web/app/[locale]/dashboard/achievements/page.tsx
  - apps/passport-web/app/[locale]/dashboard/badges/page.tsx
- 公开验证页面：
  - apps/passport-web/app/[locale]/verify/badge/[token]/page.tsx
- 管理页面：
  - apps/passport-web/app/[locale]/admin/achievements/page.tsx
  - apps/passport-web/app/[locale]/admin/badges/definitions/page.tsx
  - apps/passport-web/app/[locale]/admin/badges/awards/page.tsx
- 管理客户端组件：
  - apps/passport-web/components/admin-achievements-client.tsx
  - apps/passport-web/components/admin-badge-definitions-client.tsx
  - apps/passport-web/components/admin-badge-awards-client.tsx

4. 入口与导航打通
- dashboard 快捷操作新增成就/徽章入口：
  - apps/passport-web/app/[locale]/dashboard/page.tsx
- 账户菜单新增成就/徽章与管理入口：
  - apps/passport-web/components/user-account-menu.tsx
- admin shell 新增“成就与徽章”分组：
  - apps/passport-web/components/admin-shell.tsx

5. 业务触发打通（自动写入成就）
- 注册成功触发：
  - apps/passport-web/app/api/auth/register/route.ts
- 资料维护成功触发：
  - apps/passport-web/app/api/dashboard/profile/route.ts
- 证书签发成功触发：
  - apps/passport-web/app/api/admin/certificates/issue/route.ts
- 验证员签到成功触发：
  - apps/passport-web/app/api/verifier/scan/route.ts

6. 跟踪器更新
- docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md 新增 CP-TODO-192 并标记 done。

7. 运行时修复补充（2026-05-26）
- 问题现象：`/dashboard/achievements` 与 `/dashboard/badges` 在开发环境下触发 `Cannot read properties of undefined (reading 'findMany')`。
- 根因拆分：
  - 一类是 Prisma Client 与新增模型不一致导致模型属性运行时不可用。
  - 另一类是数据库尚未迁移新表时触发 `P2021`（缺少 `public.achievements` 等表）。
- 修复策略：
  - 在服务层 `apps/passport-web/lib/server/achievement-badge.ts` 增加运行时模型存在性检查。
  - 对 `P2021` 缺表错误做非关键链路降级（返回空结果或跳过写入），避免注册/页面渲染被中断。
  - 在用户页面 `apps/passport-web/app/[locale]/dashboard/achievements/page.tsx` 与 `apps/passport-web/app/[locale]/dashboard/badges/page.tsx` 增加读取兜底，缺表时展示空态而非崩溃。
- 回归验证：
  - `npm run build` 通过。
  - `npm test` 38/38 通过。
  - 浏览器复测：`/zh/dashboard/achievements`、`/zh/dashboard/badges` 均可打开并显示空态，不再出现运行时崩溃弹窗。
