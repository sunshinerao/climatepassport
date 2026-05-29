# 活动模块 Gap Analysis 补全 — 20260529

## 需求解读

对照活动模块开发计划，与已实现代码进行全面差距分析，补全以下缺失项目：

1. `PATCH /api/activity-tasks/[id]` + `DELETE` — 任务单条编辑/删除 API
2. `GET /api/activity-applications/[id]` + `PATCH (withdraw)` — 报名申请单条查询及用户撤回
3. `/admin/activities/[id]/rewards` — 每个活动的奖励规则管理页面（区别于全局页面）
4. 管理侧边导航 — 添加"扫码签到站"链接（`/admin/activities-checkin`）
5. TypeScript 0 错误验证

## 修改方法

- 按最小改动原则，各文件独立创建/修改
- 利用现有 Prisma 模型，复用已有 auth/API 模式
- 对撤回操作，使用 `getCurrentUser()` 实现用户自助撤回，同时允许管理员代为操作

## 修改内容

### 新建文件

#### `apps/passport-web/app/api/activity-tasks/[id]/route.ts`
- `GET` — 按 ID 查询单个任务（含子任务）
- `PATCH` — 编辑任务标题/类型/积分/时间等字段（部分更新）
- `DELETE` — 删除任务（如有提交/签到记录则拒绝，返回 409）

#### `apps/passport-web/app/api/activity-applications/[id]/route.ts`
- `GET` — 管理员查询单条报名申请（含活动信息）
- `PATCH` — 支持 `action: "withdraw"` 由用户或管理员执行撤回；支持 `formResponseJson` / `reviewComment` 字段更新

#### `apps/passport-web/app/[locale]/admin/activities/[id]/rewards/page.tsx`
- 显示指定活动的 `ActivityRewardRule` 列表（触发条件/奖励类型/奖励值）
- 显示指定活动的 `ActivityCertificateRule` 列表（证书定义/自动颁发/条件）
- 快速链接：活动详情 / 参与记录 / 全局奖励规则 / 全局证书规则
- 面包屑导航：活动管理 → 活动名称 → 奖励规则

### 修改文件

#### `apps/passport-web/components/admin-shell.tsx`
- 在"活动中心"子菜单末尾追加"扫码签到站"链接（`/admin/activities-checkin`）
- 角色限制：`ADMIN | EVENT_MANAGER | VERIFIER`

## TypeScript 状态

`npx tsc --noEmit` → **0 错误**
