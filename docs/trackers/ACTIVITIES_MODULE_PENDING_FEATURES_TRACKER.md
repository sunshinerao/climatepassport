# Activities Module Pending Features Tracker

**规范依据**: `docs/ACTIVITIES_MODULE_DEVELOPMENT_PLAN_20260528.md`
Last updated: 2026-05-31

---

## 已完成 (Completed)

### Phase 1 — MVP

#### P1-D: 数据层

- [x] **P1-D-1** 新增全部 Activity 枚举（15 个 enum）`prisma/schema.prisma`
- [x] **P1-D-2** 新增核心模型：Activity, ActivityDetail, ActivityRole, ActivityApplication, ActivityParticipation, ActivityFormTemplate
- [x] **P1-D-3** 新增任务与签到模型：ActivityTask（含子任务 self-relation）, ActivitySubmission, ActivityCheckinRecord
- [x] **P1-D-4** 新增奖励与审核模型：ActivityRewardRule, ActivityCertificateRule, ActivityReviewWorkflow
- [x] **P1-D-5** 扩展现有表：PointTransaction / PassportMilestone / QrToken 加 activityId
- [x] **P1-D-6** ⚠️ Migration SQL 文件已创建，**Neon DB 尚未执行 `prisma migrate deploy`**（需手动部署后才生效）
  - Migration for INTERVIEW/OFFERED: `prisma/migrations/20260529100000_activities_learning_application_states/migration.sql`

#### P1-API: 后端 API

- [x] **P1-API-1/2** `GET/POST /api/activities` — 活动列表 + 创建
- [x] **P1-API-3** `GET /api/activities/[slug]` — 活动详情
- [x] **P1-API-4** `PATCH /api/activities/[id]` — 编辑活动
- [x] **P1-API-5** `PATCH /api/activities/[id]/status` — 上下架
- [x] **P1-API-6** `PATCH /api/activities/[id]/detail` — 类型专属配置
- [x] **P1-API-7** `POST /api/activities/[id]/apply` — 用户报名（含自动审核逻辑）
- [x] **P1-API-8** `GET /api/activity-applications` — 报名列表（admin）
- [x] **P1-API-9** `PATCH /api/activity-applications/[id]/review` — 审核（含 INTERVIEW/OFFERED/WAITLISTED）
- [x] **P1-API-12** `GET /api/activities/[id]/checkin/qr` — QR 生成（HMAC-SHA256 签名）
- [x] **P1-API-13/14** `POST /api/checkin/activity-verify` — 扫码核验 + 防重复 + 写 ActivityCheckinRecord
- [x] **P1-API-15** `GET /api/activity-checkin` — 签到记录列表
- [x] **P1-API-16** `GET /api/activity-participations` — 参与者列表
- [x] **P1-API-17** 参与状态管理 `PATCH /api/activity-participations/[id]`

#### P1-ADMIN: 后台管理

- [x] **P1-ADMIN-1** Admin Shell 更新 — 活动中心 13 个菜单项（按类型分区：EVENT/LEARNING/CHALLENGE/PROJECT/COURSE + 跨类型工具）
- [x] **P1-ADMIN-1b** Admin Shell 类型分区二级菜单 — 每类型有独立列表/创建/管理入口（2026-05-31）
- [x] **P1-ADMIN-2** 活动列表页 `/admin/activities`（支持 `?type=` 过滤、类型标签页、类型感知创建按钮）
- [x] **P1-ADMIN-3** 创建活动页 `/admin/activities/new`（单表单，含类型选择）
- [x] **P1-ADMIN-4** 活动详情/编辑页 `/admin/activities/[id]` + `/admin/activities/[id]/edit`
- [x] **P1-ADMIN-5** 报名审核页 `/admin/activities/[id]/applications`
- [x] **P1-ADMIN-6** 参与者管理页 `/admin/activities/[id]/participations`
- [x] **P1-ADMIN-7** 扫码签到页 `/admin/activities-checkin`（摄像头扫码 + 状态展示）

#### P1-WEB: 用户端

- [x] **P1-WEB-1** 活动发现页 `/[locale]/activities`
- [x] **P1-WEB-2** 活动详情页 `/[locale]/activities/[slug]`（统一壳 + EventContent 渲染）
- [x] **P1-WEB-3** 报名/申请页 `/[locale]/activities/[slug]/apply`
- [x] **P1-WEB-4** 我的活动页（10-Tab） `/[locale]/dashboard/my-activities`

---

### Phase 2 — 核心引擎

#### P2-API: Task / Submission / Review

- [x] **P2-API-1/2/3** ActivityTask CRUD `GET/POST /api/activity-tasks`, `PATCH/DELETE /api/activity-tasks/[id]`
- [x] **P2-API-5/6** ActivitySubmission 提交 + 列表 `POST/GET /api/activity-submissions`
- [x] **P2-API-7** 提交物审核 `PATCH /api/activity-submissions/[id]/review`（含 SUBMISSION_APPROVED + TASK_COMPLETED 触发）
- [x] **P2-API-9** 全局审核队列 `GET /api/activity-reviews`
- [x] **P2-API-10** 执行审核 `PATCH /api/activity-reviews/[id]`

#### P2-API: Reward Engine

- [x] **P2-API-12/13** 奖励规则 `GET/POST /api/activity-reward-rules`；`DELETE /api/activity-reward-rules?id=`
- [x] **P2-API-14** 内部奖励触发器 `lib/server/activity-rewards.ts`
  - 已实现 trigger 类型：REGISTRATION_APPROVED / CHECKIN_COMPLETED / CONSECUTIVE_CHECKIN / SUBMISSION_APPROVED / TASK_COMPLETED / PARTICIPATION_COMPLETED
  - 已实现 reward 类型：POINTS（积分发放，幂等）/ PASSPORT_ENTRY / **BADGE**（创建 BadgeAward + append badgeAwardIds）
- [x] **P2-API-16** 证书规则 `GET /api/activity-certificate-rules`

#### P2-API: Learning

- [x] **P2-API-17** Learning 申请扩展状态 INTERVIEW / OFFERED（schema enum + migration SQL + review API）

#### P2-ADMIN

- [x] **P2-ADMIN-1** 任务管理页 `/admin/activities/[id]/tasks`
- [x] **P2-ADMIN-2** 提交物审核页 `/admin/activities/[id]/submissions`
- [x] **P2-ADMIN-3** 签到记录页 `/admin/activities/[id]/checkin`
- [x] **P2-ADMIN-4** 奖励规则配置页 `/admin/activities/[id]/rewards`（含创建/删除表单 `AdminRewardRuleFormClient`）
- [x] **P2-ADMIN-5** 全局审核中心 `/admin/activities/reviews`
- [x] **P2-ADMIN-6** 表单模板管理 `/admin/activities/form-templates`

#### P2-WEB

- [x] **P2-WEB-1** 参与工作台 `/[locale]/activities/[slug]/workspace`
- [x] **P2-WEB-2** 任务详情/提交页 `/[locale]/activities/[slug]/tasks/[taskId]`
- [x] **P2-WEB-3** My Activities 10-Tab 全部实现（Tab 1–10）
- [x] **P2-WEB-4** Learning Experience 详情渲染（大纲/导师/申请要求）
- [x] **P2-WEB-5** 积分流水页 `/[locale]/dashboard/points`

---

### Phase 3 — 全类型扩展（已完成部分）

#### P3-DATA

- [x] **P3-DATA-1** ProjectMilestone + ProjectDeliverable 模型（schema 已有）

#### P3-API

- [x] **P3-API-1** Challenge 排行榜页 `/[locale]/activities/[slug]/leaderboard`
  - 3 维度：individual / organization / country
  - 3 时间周期：all_time / weekly / daily
  - 时间维度通过 PointTransaction groupBy 实现，URL 参数 `?dim=&period=`
- [x] **P3-API-3** Project 里程碑 API `GET/POST /api/project-milestones`，`PATCH/DELETE /api/project-milestones?id=`

#### P3-ADMIN

- [x] **P3-ADMIN-2** 里程碑管理页 `/admin/activities/[id]/milestones`（含 `AdminProjectMilestonesClient`）
- [x] **P3-ADMIN-4** 数据统计页 `/admin/activities/[id]/analytics`（6 stat cards + 签到趋势 + 任务完成率）
- [x] **P3-ADMIN-5** 机构与主办方管理 `/admin/activity-organizers`（含 EVENT_MANAGER 角色授权）
  - 配套 API：`PATCH /api/admin/users/[userId]/role`

#### P3-WEB

- [x] **P3-WEB-1** Challenge 类型内容渲染（活动详情页 inline：规则/积分/团队/任务序列/排行榜链接）
- [x] **P3-WEB-2** Project 类型内容渲染（活动详情页 inline：里程碑/背景/角色招募）

---

## 进行中 (In Progress)

_（当前无进行中任务）_

---

## 待完成 (Pending)

### Phase 3 — 未完成项

#### P3-API（待完成）

- [ ] **P3-API-2** 排行榜 Redis 预计算后台 Job（每15分钟）
  - 当前实现：实时 DB 查询；高并发时需升级为 Redis 缓存方案
  - 技术方案：Vercel Cron Job + Redis（Upstash）

- [ ] **P3-API-4** 外部 LMS 对接 webhook 端点
  - 文件规划: `app/api/lms-webhook/[provider]/route.ts`
  - 支持: tutor_lms / moodle / xiaoe_tech / custom

#### P3-ADMIN（待完成）

- [ ] **P3-ADMIN-1** Challenge 类型专属管理表单（configJson 字段可视化编辑器）

- [ ] **P3-ADMIN-3** Course 类型专属配置 + LMS 配置表单

- [ ] **P3-ADMIN-6** 类型与模板管理专用页面 `/admin/activity-templates`
  - 当前表单模板管理位于 `/admin/activities/form-templates`（功能等价，路径与原规划有差异）

- [x] **P3-WEB-5** 签到海报页 `/[locale]/activities/[slug]/checkin-poster`（服务端生成个人专属 QR，含打印样式，2026-05-31）

#### P3-SHCW 对齐（2026-05-31 新增，部分完成）

- [x] **P3-SHCW-1** 活动表单：场地/地址/城市双语字段（写入 Activity.locationJson）
- [x] **P3-SHCW-2** 活动表单：邀请函正文 HTML（中/英，写入 ActivityDetail.configJson）
- [x] **P3-SHCW-3** 活动详情：按类型显示专属子导航（EVENT/PROJECT/CHALLENGE/LEARNING）
- [ ] **P3-SHCW-4** `maxAttendees` 独立字段（当前用 capacity 代替，SHCW 有区别对待）
- [ ] **P3-SHCW-5** `isClosed`（报名关闭状态，当前通过 registrationCloseAt 实现）
- [ ] **P3-SHCW-6** `eventDateSlots` 多日期时段（当前通过 AgendaItem 分组代替）
- [ ] **P3-SHCW-7** `partners[]` 合作伙伴列表字段的 Admin 表单（数据结构已有，无编辑 UI）
  - 当前仅通过 configJson 通用渲染，未实现章节进度/测验展示

#### P3-INFRA（全部待完成，Phase 3 未来项）

- [ ] **P3-INFRA-1** 证书区块链背书集成
- [ ] **P3-INFRA-2** Event → Activity 历史数据迁移脚本
- [ ] **P3-INFRA-3** Registration → ActivityApplication 迁移脚本
- [ ] **P3-INFRA-4** LearningExperienceProgram → Activity 迁移脚本
- [ ] **P3-INFRA-5** 旧路由 301 重定向配置

---

### 跨阶段通用任务

- [ ] **CROSS-1** i18n：各语言 locale 文件增加 activities 模块相关 key
- [ ] **CROSS-2** 错误边界：所有新页面添加 `loading.tsx` + `error.tsx`
- [ ] **CROSS-3** SEO：用户端页面添加 `generateMetadata()`
- [ ] **CROSS-4** 回归测试：执行现有 Event/Learning/Certificate 模块回归检查
- [ ] **CROSS-5** 文档更新：更新 `CURRENT_IMPLEMENTATION_STATUS.md`

---

## 重要待办提醒

> ⚠️ **DB Migration 未执行**：`prisma/migrations/20260529100000_activities_learning_application_states/migration.sql` 已创建但未部署。需执行 `npx prisma migrate deploy`（生产）或 `npx prisma db push`（开发）后，`INTERVIEW` / `OFFERED` 状态才在数据库中生效。
