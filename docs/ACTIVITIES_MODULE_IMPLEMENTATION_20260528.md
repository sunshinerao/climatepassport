# 活动模块实现文档 — ACTIVITIES_MODULE_IMPLEMENTATION_20260528

## 需求解读

气候护照平台需要一个完整的「活动中心」模块，支持多类型活动（活动/学习/挑战/项目/任务/课程），覆盖从创建到参与、签到、任务完成、奖励发放的全生命周期。系统需同时服务管理员（活动管理、审核、报表）和普通用户（浏览、报名、参与跟踪）。

## 修改方法

按分层架构实现：
1. **数据层**：扩展 Prisma schema，添加所有枚举和模型，执行迁移
2. **API 层**：创建 16 个 RESTful 端点，统一鉴权（`requireRoleAccess`）和 DB null 守卫
3. **管理后台**：遵循 `proto-admin-*` 样式体系，创建 18 个服务端页面 + 4 个客户端组件
4. **用户端**：遵循已有 dashboard 样式模式，创建公开浏览页、活动详情页及用户活动面板

## 修改内容

### 数据库 Schema（prisma/schema.prisma）

新增枚举（16个）：
- `ActivityType`, `ActivityStatus`, `ActivityVisibility`, `ActivityLocationType`
- `ActivityApplicationStatus`, `ActivityParticipationStatus`, `ActivityRoleType`
- `ActivityTaskType`, `ActivitySubmissionStatus`
- `ActivityCheckinMethod`, `ActivityCheckinStatus`
- `ActivityRewardTrigger`, `ActivityRewardType`
- `ActivityReviewObjectType`, `ActivityReviewType`, `ActivityReviewStatus`

新增模型（14个）：
- `Activity` (@@map "activities") — 活动主表，含类型/状态/可见性/容量/报名时间/表单模板等
- `ActivityDetail` (@@map "activity_details") — 活动详情（一对一），存储富文本/附件/FAQ
- `ActivityRole` (@@map "activity_roles") — 活动角色定义
- `ActivityApplication` (@@map "activity_applications") — 报名申请，含审核状态和问卷答案
- `ActivityParticipation` (@@map "activity_participations") — 参与记录，含积分/徽章/证书/护照同步状态
- `ActivityFormTemplate` (@@map "activity_form_templates") — 报名表单模板
- `ActivityTask` (@@map "activity_tasks") — 活动任务（支持父子关系）
- `ActivitySubmission` (@@map "activity_submissions") — 任务提交记录
- `ActivityCheckinRecord` (@@map "activity_checkin_records") — 签到记录，含去重逻辑
- `ActivityRewardRule` (@@map "activity_reward_rules") — 奖励规则（触发器→奖励类型）
- `ActivityCertificateRule` (@@map "activity_certificate_rules") — 证书颁发规则
- `ActivityReviewWorkflow` (@@map "activity_review_workflows") — 评审工作流
- `ProjectMilestone` (@@map "project_milestones") — 项目里程碑
- `ProjectDeliverable` (@@map "project_deliverables") — 项目交付物

扩展已有模型：
- `PointTransaction` — 新增 `activityId` 关联字段
- `PassportMilestone` — 新增 `activityId` 关联字段
- `QrToken` — 新增 `activityId` 关联字段

迁移：`20260528141937_activities_module`（成功执行）

### 管理后台导航（apps/passport-web/components/admin-shell.tsx）

新增「活动中心」菜单组（11个子项），插入证书中心之前：
- 活动列表 `/admin/activities`
- 创建活动 `/admin/activities/new`（ADMIN 专属）
- 报名审核 `/admin/activities/applications`
- 参与管理 `/admin/activities/participations`
- 签到管理 `/admin/activities/checkin`
- 任务管理 `/admin/activities/tasks`
- 作品审核 `/admin/activities/submissions`
- 奖励规则 `/admin/activities/rewards`
- 证书规则 `/admin/activities/certificates`
- 评审工作流 `/admin/activities/reviews`
- 表单模板 `/admin/activities/form-templates`（ADMIN 专属）

### API 路由（16个文件）

| 路径 | 方法 | 功能 |
|------|------|------|
| `app/api/activities/route.ts` | GET/POST | 活动列表（分页/过滤）/ 创建活动 |
| `app/api/activities/[id]/route.ts` | GET/PATCH/DELETE | 活动详情/更新/删除 |
| `app/api/activities/[id]/stats/route.ts` | GET | 活动数据统计 |
| `app/api/activities/[id]/status/route.ts` | PATCH | 状态流转 |
| `app/api/activity-applications/route.ts` | GET/POST | 报名申请列表/提交 |
| `app/api/activity-applications/[id]/review/route.ts` | PATCH | 审核（自动创建参与记录） |
| `app/api/activity-participations/route.ts` | GET/POST | 参与记录列表/创建 |
| `app/api/activity-participations/[id]/route.ts` | PATCH | 更新参与记录 |
| `app/api/activity-checkin/route.ts` | GET/POST | 签到记录/登记（5分钟去重） |
| `app/api/activity-submissions/route.ts` | GET/POST | 作品列表/提交 |
| `app/api/activity-submissions/[id]/review/route.ts` | PATCH | 作品审核（含评分） |
| `app/api/activity-tasks/route.ts` | GET/POST | 任务管理（含子任务） |
| `app/api/activity-reward-rules/route.ts` | GET/POST/DELETE | 奖励规则管理 |
| `app/api/activity-certificate-rules/route.ts` | GET/POST | 证书规则管理 |
| `app/api/activity-reviews/route.ts` | GET/PATCH | 评审工作流管理 |
| `app/api/activity-form-templates/route.ts` | GET/POST | 表单模板管理 |

### 客户端组件（4个文件）

- `components/admin-activities-client.tsx` — 活动列表表格（搜索/过滤/状态徽章/创建入口）
- `components/admin-activity-form-client.tsx` — 创建/编辑活动完整表单（自动生成 slug）
- `components/admin-activity-detail-client.tsx` — 活动详情页（统计卡片/状态流转/子模块链接）
- `components/admin-activity-applications-client.tsx` — 报名审核表格（内联审批/拒绝/候补操作）

### 管理后台页面（18个服务端页面）

**活动全局管理**：
- `app/[locale]/admin/activities/page.tsx` — 活动列表
- `app/[locale]/admin/activities/new/page.tsx` — 创建活动
- `app/[locale]/admin/activities/applications/page.tsx` — 跨活动报名审核
- `app/[locale]/admin/activities/participations/page.tsx` — 跨活动参与管理
- `app/[locale]/admin/activities/checkin/page.tsx` — 跨活动签到记录
- `app/[locale]/admin/activities/tasks/page.tsx` — 跨活动任务管理
- `app/[locale]/admin/activities/submissions/page.tsx` — 跨活动作品审核
- `app/[locale]/admin/activities/rewards/page.tsx` — 奖励规则（ADMIN）
- `app/[locale]/admin/activities/certificates/page.tsx` — 证书规则（ADMIN）
- `app/[locale]/admin/activities/reviews/page.tsx` — 评审工作流
- `app/[locale]/admin/activities/form-templates/page.tsx` — 表单模板（ADMIN）

**单个活动管理**（`/admin/activities/[id]/...`）：
- `page.tsx` — 活动详情
- `edit/page.tsx` — 编辑活动
- `applications/page.tsx` — 该活动报名审核
- `participations/page.tsx` — 该活动参与列表
- `checkin/page.tsx` — 该活动签到记录
- `tasks/page.tsx` — 该活动任务（含子任务展开）
- `submissions/page.tsx` — 该活动作品提交

### 用户端页面（3个服务端页面）

- `app/[locale]/activities/page.tsx` — 公开活动浏览页（卡片网格，支持精选/状态展示）
- `app/[locale]/activities/[slug]/page.tsx` — 活动详情页（信息展示/报名操作/任务列表）
- `app/[locale]/dashboard/my-activities/page.tsx` — 用户活动面板（参与状态/申请状态/积分统计）

### 类型修复

全部文件通过 `npx tsc --noEmit` 验证（0 错误）：
- 所有 API 路由：`requireRoleAccess` 的 null locale 改为 `"en" as any`
- 所有页面/API：`getPrismaClient()` 后添加 null 守卫
- `admin-activity-form-client.tsx`：`.map()` 回调参数类型标注
