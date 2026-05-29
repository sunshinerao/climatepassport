# Climate Passport — Activities 模块完整开发计划

> **版本**: 1.1（已对照两份原始规范文件补全所有遗漏点）
> **日期**: 2026-05-28
> **参考来源**:
> - `climate_passport_activities_tech_spec.md`（中文技术规范，Plan B）
> - `climate-passport-activities-spec.md`（英文 Agent-Ready 规范，Plan A）
> **合并原则**: 以英文规范为技术骨架，以中文规范补充 DB 结构细节，两者冲突处均有说明

---

## 一、现有架构与 Activities 模块的关系

### 1.1 已存在、需要保留（不改动）

| 现有模型 | 对应 Activities 概念 | 策略 |
|--------|-------------------|------|
| `Event` | Activity type=event | Phase 1 保留，Phase 3 建关联桥 |
| `Registration` | ActivityApplication（Event 专属） | 保留，Phase 3 可关联 |
| `CheckIn` | CheckinRecord（Event 专属） | 保留，Phase 3 可关联 |
| `LearningExperienceProgram` | Activity type=learning_experience | 保留，Phase 3 建关联桥 |
| `LearningExperienceApplication` | ActivityApplication（Learning 专属）| 保留 |
| `LearningExperienceParticipation` | Participation（Learning 专属）| 保留 |
| `PointTransaction` | 积分流水 | 扩展 `activityId` 字段 |
| `BadgeAward` + `BadgeDefinition` | 徽章系统 | 保留，通过 RewardRule 触发 |
| `CertificateIssue` + `CertificateDefinition` | 证书系统 | 保留，通过 CertificateRule 触发 |
| `Achievement` + `PassportMilestone` | Passport Timeline | 扩展关联到 Activity |
| `QrToken` | QR 签到令牌 | 扩展 `activityId` 字段 |

### 1.2 需要新增（Activities 核心表体系）

新增 12 个模型，全部独立建表，**不修改现有表的现有字段**：

`Activity` / `ActivityDetail` / `ActivityApplication` / `ActivityParticipation` / `ActivityRole` / `ActivityTask` / `ActivitySubmission` / `ActivityCheckinRecord` / `ActivityRewardRule` / `ActivityCertificateRule` / `ActivityReviewWorkflow` / `ActivityFormTemplate`

Phase 3 额外增加：`ProjectMilestone` / `ProjectDeliverable`

### 1.3 现有表最小扩展（仅加字段）

| 表 | 扩展字段 | 原因 |
|----|---------|------|
| `PointTransaction` | `activityId String?` | 关联到 Activity（当前只能关联 Event） |
| `PassportMilestone` | `activityId String?` | Timeline 可指向 Activity（当前只能指向 Event） |
| `QrToken` | `activityId String?` | 签到 QR 关联到 Activity（当前只能关联 Event） |

---

## 二、架构八原则

| 编号 | 原则 | 说明 |
|------|------|------|
| 1 | **统一基础** | 六类活动共享统一 Activity 基础表，通过 type 字段区分 |
| 2 | **统一报名** | 所有报名/申请统一为 ActivityApplication，状态机统一 |
| 3 | **统一参与** | 参与记录统一为 ActivityParticipation，写入 Passport Timeline |
| 4 | **统一角色** | ActivityRole 统一角色管理，不硬编码 |
| 5 | **统一任务** | ActivityTask 统一任务系统，可被各类活动复用，支持嵌套子任务 |
| 6 | **统一提交** | ActivitySubmission 统一提交物管理 |
| 7 | **统一审核** | ActivityReviewWorkflow 统一审核机制，支持 7 种审核方式 |
| 8 | **统一奖励** | ActivityRewardRule 统一积分/徽章/证书/技能标签触发 |

---

## 三、数据模型设计

### 3.1 新增枚举

```prisma
enum ActivityType {
  EVENT            // 活动/会议
  LEARNING         // 学习体验
  CHALLENGE        // 挑战/行动
  PROJECT          // 项目
  TASK             // 任务（单体，也作为其他类型的子任务）
  COURSE           // 课程
}

enum ActivityStatus {
  DRAFT            // 草稿
  PUBLISHED        // 已发布
  ONGOING          // 进行中（start_time 已到，区别于 PUBLISHED）
  COMPLETED        // 已结束
  CANCELLED        // 已取消
  ARCHIVED         // 已归档
}

enum ActivityVisibility {
  PUBLIC           // 公开
  PRIVATE          // 私密（仅受邀可见）
  UNLISTED         // 不列出（有链接可访问，但不出现在列表中）
  INVITE_ONLY      // 仅邀请（报名须受邀）
}
// 说明：英文原规范有 unlisted，中文原规范有 invite_only，均保留，语义不同

enum ActivityLocationType {
  ONLINE
  OFFLINE
  HYBRID
}

enum ActivityApplicationStatus {
  DRAFT
  SUBMITTED
  PENDING_REVIEW
  APPROVED
  REJECTED
  WAITLISTED
  CANCELLED
  WITHDRAWN
}

enum ActivityParticipationStatus {
  REGISTERED
  ACCEPTED
  CHECKED_IN
  IN_PROGRESS
  COMPLETED
  FAILED
  ABSENT
  CERTIFIED
  ARCHIVED
}

enum ActivityRoleType {
  APPLICANT
  PARTICIPANT
  ATTENDEE
  SPEAKER
  MODERATOR
  PANELIST
  MENTOR
  REVIEWER
  VOLUNTEER
  ORGANIZER
  TEAM_LEADER
  TEAM_MEMBER
  LEARNER
  INSTRUCTOR
  PARTNER_REPRESENTATIVE
  MEDIA
}

enum ActivityTaskType {
  CHECK_IN
  UPLOAD
  QUIZ
  REFLECTION
  ATTENDANCE
  SHARE
  SURVEY
  LEARNING_UNIT
  PROJECT_MILESTONE
  TEAM_ACTION
}

enum ActivitySubmissionStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  REVISION_REQUIRED
}

enum ActivityCheckinMethod {
  QR_CODE
  MANUAL
  GEO
  NFC
  FACIAL   // 中文原规范包含，保留
}

enum ActivityCheckinStatus {
  // 合并两份原规范（英文：valid/duplicate/invalid/outside_window；中文：success/failed/duplicate/out_of_range/expired）
  VALID            // 有效（英文原规范 valid ≈ 中文 success）
  DUPLICATE        // 重复签到
  INVALID          // 无效
  OUTSIDE_WINDOW   // 超出时间窗口（英文原规范；≈ 中文 out_of_range）
  FAILED           // 签到失败（中文原规范特有，用于系统故障场景）
  EXPIRED          // 已过期（中文原规范特有，区别于 OUTSIDE_WINDOW）
}

enum ActivityRewardTrigger {
  REGISTRATION_APPROVED  // 报名审核通过
  CHECKIN_COMPLETED      // 完成签到
  TASK_COMPLETED         // 完成任务
  CONSECUTIVE_CHECKIN    // 连续签到
  SUBMISSION_APPROVED    // 提交物审核通过
  COURSE_COMPLETED       // 完成课程
  PROJECT_COMPLETED      // 完成项目
  EXCELLENT_REVIEW       // 获得优秀评价
  ROLE_ASSIGNED          // 被分配特定角色（中文原规范：special_role）
  REFERRAL_SUCCESS       // 邀请成功（中文原规范：invite_success）
  PARTICIPATION_COMPLETED // 参与状态变为 completed
}

enum ActivityRewardType {
  POINTS           // 积分
  BADGE            // 徽章
  CERTIFICATE      // 证书
  PASSPORT_ENTRY   // Passport Timeline 条目（英文规范；≈ 中文 timeline_update）
  LEADERBOARD      // 排行榜更新（英文规范；≈ 中文 ranking）
  SKILL_TAG        // 技能标签（中文原规范特有，保留）
  NOTIFICATION     // 通知
}

enum ActivityReviewObjectType {
  APPLICATION        // 报名/申请审核
  SUBMISSION         // 提交物审核
  CHECKIN            // 手动签到核验
  CERTIFICATE_REQUEST // 证书资格审核
  PROJECT_OUTPUT     // 项目成果审核
  VOLUNTEER_HOURS    // 志愿时长核验（两份原规范均有）
}

enum ActivityReviewType {
  AUTO              // 自动审核
  ADMIN             // 管理员审核
  MENTOR            // 导师审核
  ORGANIZATION      // 机构审核
  EXPERT            // 专家评分
  MULTI_SCORE       // 多评审人聚合评分
  PUBLIC_VOTE       // 公众投票 + 专家确认
}

enum ActivityReviewStatus {
  PENDING
  APPROVED
  REJECTED
  REVISION_REQUIRED
}
```

### 3.2 核心模型

#### Activity（活动基础表）

```prisma
model Activity {
  id                   String              @id @default(uuid())
  type                 ActivityType
  title                String
  titleEn              String?
  subtitle             String?
  subtitleEn           String?
  slug                 String              @unique  // auto-generated: title + random 4-char suffix
  category             String?
  coverImage           String?
  summary              String?             @db.Text
  summaryEn            String?             @db.Text
  description          String?             @db.Text
  descriptionEn        String?             @db.Text
  // 主办方：关联 User（平台内）或用外部字符串
  // 说明：英文原规范 organizer_id 指向 Organization，中文原规范指向 User。
  // 决策：当前 schema 无独立 Organization 表，使用 userId，保留 organizerName 作 fallback。
  organizerUserId      String?
  organizerName        String?
  partnerIds           String[]            // 合作方 ID 列表
  startTime            DateTime?
  endTime              DateTime?
  timezone             String              @default("UTC")
  locationType         ActivityLocationType?
  locationJson         Json?               // { name, address, mapUrl, capacity }
  onlineUrl            String?
  status               ActivityStatus      @default(DRAFT)
  visibility           ActivityVisibility  @default(PUBLIC)
  capacity             Int?
  registrationOpenAt   DateTime?
  registrationCloseAt  DateTime?
  requiresApproval     Boolean             @default(false)
  isFeatured           Boolean             @default(false)
  language             String              @default("zh")
  tags                 String[]
  createdByUserId      String
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  detail               ActivityDetail?
  roles                ActivityRole[]
  tasks                ActivityTask[]
  rewardRules          ActivityRewardRule[]
  certificateRules     ActivityCertificateRule[]
  applications         ActivityApplication[]
  participations       ActivityParticipation[]
  reviewWorkflows      ActivityReviewWorkflow[]
  checkinRecords       ActivityCheckinRecord[]
  submissions          ActivitySubmission[]

  @@index([type, status])
  @@index([slug])
  @@index([organizerUserId])
  @@index([isFeatured, startTime])
  @@map("activities")
}
```

#### ActivityDetail（类型专属配置，1:1）

```prisma
model ActivityDetail {
  id         String   @id @default(uuid())
  activityId String   @unique
  type       ActivityType
  configJson Json     // JSONB，schema 在服务层校验

  activity   Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@map("activity_details")
}
```

**各类型 configJson 结构：**

```jsonc
// EventDetail
{
  "agenda": [{ "time": "09:00", "title": "开幕式", "speaker": "Name" }],
  "speakers": [{ "name": "", "title": "", "bio": "", "avatarUrl": "" }],
  "venue": { "name": "", "address": "", "mapUrl": "", "capacity": 0 },
  "checkin_rule": { "method": "qr_code|manual|geo", "window_minutes": 30 },
  "ticket_types": [{ "name": "", "price": 0, "capacity": 0, "is_free": true }]
}

// LearningExperienceDetail
{
  "curriculum": "富文本",
  "mentors": [{ "user_id": "", "role": "" }],
  "application_requirements": ["requirement_1"],
  "learning_outcomes": ["outcome_1"],
  "certificate_rules": { "requires_completion": true, "min_attendance": 0.8 }
}

// ChallengeDetail
{
  "challenge_rules": "富文本",
  "leaderboard_enabled": true,
  "team_enabled": false,
  "max_team_size": 5,
  "task_series": [],
  "scoring_rules": { "base_points": 10, "bonus_conditions": [] }
}

// ProjectDetail
{
  "project_background": "富文本",
  "roles_available": [{ "role": "team_leader", "quota": 1, "description": "" }],
  "milestones": [{ "title": "", "due_date": "", "deliverables": [] }],
  "deliverables": ["deliverable_1"],
  "mentor_review": true
}

// TaskDetail
{
  "task_instruction": "富文本",
  "proof_required": true,
  "verification_method": "admin|auto|photo|geo",
  "points": 100,
  "allow_repeated_checkin": false
}

// CourseDetail
{
  "course_outline": "富文本",
  "lessons": [{ "id": "", "title": "", "content_url": "", "duration_minutes": 0 }],
  "progress_rule": { "min_lesson_completion": 1.0 },
  "quiz_rule": { "passing_score": 0.7, "max_attempts": 3 },
  "completion_rule": "all_lessons|passing_quiz|both",
  "internal_course_id": null,
  "external_lms_provider": null,   // "tutor_lms" | "moodle" | "xiaoe_tech" | "custom"
  "external_course_url": null,
  "progress_sync_status": "not_synced|syncing|synced"
}
```

#### ActivityRole（角色配置）

```prisma
model ActivityRole {
  id                     String             @id @default(uuid())
  activityId             String
  roleType               ActivityRoleType
  formTemplateId         String?            // 该角色报名时使用的表单模板
  requiresApproval       Boolean            @default(false)
  maxCount               Int?
  permissionsJson        Json?              // 可见页面、后台权限等
  // 注：使用 CertificateDefinitionId 而非 templateId，复用现有证书定义体系
  certificateDefinitionId String?
  pointsRuleJson         Json?
  badgeRuleJson          Json?
  createdAt              DateTime           @default(now())

  activity               Activity           @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@unique([activityId, roleType])
  @@index([activityId])
  @@map("activity_roles")
}
```

#### ActivityApplication（统一报名/申请）

```prisma
model ActivityApplication {
  id               String                    @id @default(uuid())
  activityId       String
  userId           String
  roleType         ActivityRoleType?         // 申请的角色（英文原规范有此字段）
  formResponseJson Json?
  status           ActivityApplicationStatus @default(DRAFT)
  submittedAt      DateTime?
  reviewedByUserId String?
  reviewComment    String?                   @db.Text
  reviewedAt       DateTime?
  createdAt        DateTime                  @default(now())
  updatedAt        DateTime                  @updatedAt

  activity         Activity                  @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@unique([activityId, userId])
  @@index([userId, status])
  @@index([activityId, status])
  @@map("activity_applications")
}
```

#### ActivityParticipation（用户参与记录 → Passport Timeline）

```prisma
model ActivityParticipation {
  id                  String                     @id @default(uuid())
  activityId          String
  userId              String
  roleType            ActivityRoleType?
  status              ActivityParticipationStatus @default(REGISTERED)
  pointsEarned        Int                        @default(0)
  certificateIssueId  String?                    // 复用现有 CertificateIssue
  badgeAwardIds       String[]                   // 复用现有 BadgeAward
  passportSynced      Boolean                    @default(false)  // 是否已写入 Timeline
  completedAt         DateTime?
  createdAt           DateTime                   @default(now())
  updatedAt           DateTime                   @updatedAt

  activity            Activity                   @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@unique([activityId, userId])
  @@index([userId, status])
  @@index([activityId])
  @@map("activity_participations")
}
```

#### ActivityTask（统一任务系统）

```prisma
model ActivityTask {
  id                        String            @id @default(uuid())
  activityId                String
  parentTaskId              String?           // 支持嵌套子任务（英文原规范）
  title                     String
  description               String?           @db.Text
  taskType                  ActivityTaskType
  isRequired                Boolean           @default(true)
  startTime                 DateTime?
  dueTime                   DateTime?
  points                    Int               @default(0)
  badgeTriggerDefinitionId  String?           // FK→BadgeDefinition（可触发徽章）
  requiresSubmission        Boolean           @default(false)
  requiresCheckin           Boolean           @default(false)
  requiresReview            Boolean           @default(false)
  orderIndex                Int               @default(0)
  ruleJson                  Json?             // 任务类型专属规则（英文原规范）
  createdAt                 DateTime          @default(now())

  activity                  Activity          @relation(fields: [activityId], references: [id], onDelete: Cascade)
  parentTask                ActivityTask?     @relation("TaskSubtasks", fields: [parentTaskId], references: [id], onDelete: SetNull)
  subtasks                  ActivityTask[]    @relation("TaskSubtasks")
  submissions               ActivitySubmission[]
  checkinRecords            ActivityCheckinRecord[]

  @@index([activityId, taskType])
  @@index([parentTaskId])
  @@map("activity_tasks")
}
```

#### ActivitySubmission（统一提交物）

```prisma
model ActivitySubmission {
  id            String                   @id @default(uuid())
  userId        String
  activityId    String
  taskId        String?                  // 任务级提交；null 表示活动级提交
  fileUrls      String[]                 // 支持多文件（英文原规范）
  textContent   String?                  @db.Text
  linkUrl       String?
  mediaType     String?                  // text/image/video/document/link/mixed
  status        ActivitySubmissionStatus @default(DRAFT)
  reviewedByUserId String?
  reviewComment String?                  @db.Text
  score         Decimal?                 @db.Decimal(5, 2)  // 英文原规范 DECIMAL(5,2)
  submittedAt   DateTime?
  createdAt     DateTime                 @default(now())
  updatedAt     DateTime                 @updatedAt

  activity      Activity                 @relation(fields: [activityId], references: [id], onDelete: Cascade)
  task          ActivityTask?            @relation(fields: [taskId], references: [id], onDelete: SetNull)

  @@index([taskId, userId])
  @@index([activityId, status])
  @@map("activity_submissions")
}
```

#### ActivityCheckinRecord（签到记录）

```prisma
model ActivityCheckinRecord {
  id           String                @id @default(uuid())
  activityId   String
  taskId       String?
  userId       String
  method       ActivityCheckinMethod
  status       ActivityCheckinStatus
  locationLat  Float?
  locationLng  Float?
  locationJson Json?                 // 完整位置信息（中文原规范 location_data）
  verifiedByUserId String?           // 手动核验时记录核验人（英文原规范）
  checkinAt    DateTime
  createdAt    DateTime              @default(now())

  activity     Activity              @relation(fields: [activityId], references: [id], onDelete: Cascade)
  task         ActivityTask?         @relation(fields: [taskId], references: [id], onDelete: SetNull)

  @@index([activityId, userId])
  @@index([taskId])
  @@index([checkinAt])
  @@map("activity_checkin_records")
}
```

#### ActivityRewardRule（统一奖励规则引擎）

```prisma
model ActivityRewardRule {
  id            String                @id @default(uuid())
  activityId    String
  trigger       ActivityRewardTrigger
  rewardType    ActivityRewardType
  rewardValueJson Json               // e.g. {"points":100} / {"badge_definition_id":"uuid"} / {"certificate_definition_id":"uuid"} / {"skill_tags":["climate_action"]}
  conditionJson Json?
  createdAt     DateTime             @default(now())

  activity      Activity             @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@index([activityId, trigger])
  @@map("activity_reward_rules")
}
```

#### ActivityCertificateRule（证书触发规则）

```prisma
model ActivityCertificateRule {
  id                      String   @id @default(uuid())
  activityId              String
  certificateDefinitionId String   // 复用现有 CertificateDefinition
  conditionJson           Json?
  autoIssue               Boolean  @default(false)
  createdAt               DateTime @default(now())

  activity                Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@index([activityId])
  @@map("activity_certificate_rules")
}
```

#### ActivityReviewWorkflow（统一审核记录）

```prisma
model ActivityReviewWorkflow {
  id           String                   @id @default(uuid())
  activityId   String
  objectType   ActivityReviewObjectType // application/submission/checkin/certificate_request/project_output/volunteer_hours
  objectId     String
  reviewerUserId String?
  reviewType   ActivityReviewType       // auto/admin/mentor/organization/expert/multi_score/public_vote（完整7种）
  status       ActivityReviewStatus     @default(PENDING)
  comment      String?                  @db.Text
  score        Int?
  createdAt    DateTime                 @default(now())
  updatedAt    DateTime                 @updatedAt

  activity     Activity                 @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@index([activityId, objectType])
  @@index([objectType, objectId])
  @@index([reviewerUserId])
  @@map("activity_review_workflows")
}
```

#### ActivityFormTemplate（统一表单模板）

```prisma
model ActivityFormTemplate {
  id            String   @id @default(uuid())
  name          String
  type          String   // registration/application/feedback/submission
  fieldsJson    Json     // JSON Schema-based 表单字段配置
  createdByUserId String
  createdAt     DateTime @default(now())

  @@map("activity_form_templates")
}
```

#### ProjectMilestone + ProjectDeliverable（Phase 3 新增）

```prisma
model ProjectMilestone {
  id          String   @id @default(uuid())
  activityId  String
  title       String
  description String?  @db.Text
  dueDate     DateTime?
  status      String   @default("upcoming") // upcoming/in_progress/completed/overdue
  orderIndex  Int      @default(0)

  deliverables ProjectDeliverable[]

  @@index([activityId])
  @@map("project_milestones")
}

model ProjectDeliverable {
  id           String  @id @default(uuid())
  milestoneId  String
  submissionId String?
  status       String  @default("pending") // pending/submitted/approved/revision_required

  milestone    ProjectMilestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)

  @@index([milestoneId])
  @@map("project_deliverables")
}
```

---

## 四、实体关系总览

```
User
├── ActivityApplication (many)
├── ActivityParticipation (many)
│     └── → Climate Passport Timeline (PassportMilestone)
├── ActivitySubmission (many)
├── ActivityCheckinRecord (many)
├── CertificateIssue (many, 复用现有)
├── BadgeAward (many, 复用现有)
└── PointTransaction (many, 扩展 activityId)

Activity
├── ActivityDetail (1:1)
├── ActivityRole (1:many)
├── ActivityTask (1:many, 支持嵌套)
├── ActivityRewardRule (1:many)
├── ActivityCertificateRule (1:many)
├── ActivityApplication (1:many)
├── ActivityParticipation (1:many)
├── ActivityReviewWorkflow (1:many)
├── ActivityCheckinRecord (1:many)
└── ActivitySubmission (1:many)

ActivityTask
├── ActivitySubmission (1:many)
├── ActivityCheckinRecord (1:many)
└── ActivityTask (self-relation, 子任务)
```

---

## 五、报名/参与状态流转

### 5.1 ApplicationStatus 流转

```
draft → submitted → pending_review → approved → [参与开始]
                                   ↘ rejected
                                   ↘ waitlisted → approved（有名额时）
         submitted → withdrawn（用户主动撤回）
         approved  → cancelled
```

### 5.2 ParticipationStatus 流转

```
registered → accepted → checked_in → in_progress → completed → certified
                                                   ↘ failed
                                   ↘ absent
```

### 5.3 Next Action 逻辑（用于"我的活动"工作台 CTA）

| 参与状态 | 中文提示 | 英文提示 |
|---------|---------|---------|
| `SUBMITTED` | 等待审核 | Awaiting review |
| `PENDING_REVIEW` | 等待审核 | Awaiting review |
| `APPROVED` | 查看活动详情 | View activity |
| `ACCEPTED` | 待开始 / [开始时间] | Starts on [date] |
| `CHECKED_IN` | 进入工作台 | Enter workspace |
| `IN_PROGRESS` + 有待签到任务 | 立即打卡 | Check in now |
| `IN_PROGRESS` + 有待提交任务 | 提交成果 | Submit work |
| `IN_PROGRESS` + 无待办 | 查看任务进度 | View task progress |
| `COMPLETED` | 查看证书 | View certificate |
| `CERTIFIED` | 下载证书 | Download certificate |
| `ABSENT` | 查看详情 | View details |
| `FAILED` | 查看详情 | View details |

---

## 六、API 设计

### 6.1 ActivityService
```
POST   /api/activities                         创建活动（Admin/Organizer）
GET    /api/activities                         列表/搜索（支持 type/status/tag/date/category 筛选，分页，CSV 导出）
GET    /api/activities/:slug                   活动详情（公开）
PATCH  /api/activities/:id                     编辑活动
PATCH  /api/activities/:id/status              上下架/归档
GET    /api/activities/:id/detail              类型专属配置
PATCH  /api/activities/:id/detail              更新类型专属配置
```

### 6.2 ApplicationService
```
POST   /api/activities/:id/apply               用户提交报名/申请
GET    /api/activities/:id/applications        报名列表（Admin，支持分页/搜索/状态筛选/CSV 导出）
PATCH  /api/applications/:id/status            审核（approve/reject/waitlist）
POST   /api/applications/:id/withdraw          用户撤回
GET    /api/users/:id/activity-applications    用户报名历史
```

### 6.3 ParticipationService
```
GET    /api/activities/:id/participants        参与者列表（Admin，支持角色/状态筛选/CSV 导出）
GET    /api/users/:id/activity-participations  用户参与记录
PATCH  /api/participations/:id/status          更新状态
POST   /api/participations/:id/sync-passport   触发写入 Passport Timeline
```

### 6.4 TaskService
```
POST   /api/activities/:id/tasks               创建任务
GET    /api/activities/:id/tasks               任务列表
PATCH  /api/tasks/:id                          编辑任务
GET    /api/tasks/:id/progress/:userId         用户任务进度
```

### 6.5 CheckinService
```
POST   /api/activities/:id/checkin/qr          生成签到二维码（嵌入 HMAC-SHA256 签名）
POST   /api/checkin/verify                     扫码核验并记录（高可用快速端点，考虑 edge caching）
GET    /api/checkin/scan/:code                 快速扫码端点（现场使用）
GET    /api/activities/:id/checkins            签到记录（Admin，支持 CSV 导出）
POST   /api/checkins/:id/override              手动补签（Admin）
```

QR payload 结构：
```json
{
  "activity_id": "uuid",
  "task_id": "uuid|null",
  "expires_at": "ISO8601",
  "signature": "HMAC-SHA256"
}
```

### 6.6 SubmissionService
```
POST   /api/tasks/:id/submit                   提交任务成果（含文件上传）
GET    /api/tasks/:id/submissions              提交列表（Admin，支持 CSV 导出）
PATCH  /api/submissions/:id/review             审核提交物（Admin/Mentor/Expert）
GET    /api/users/:id/submissions              用户提交历史
```

### 6.7 ReviewService
```
GET    /api/reviews                            全局审核队列（Admin，按 objectType 筛选，支持 CSV 导出）
PATCH  /api/reviews/:id                        执行审核动作（支持 7 种审核方式）
GET    /api/reviews/object/:type/:id           某对象的审核历史
POST   /api/reviews/:targetType/:targetId      提交审核决定
```

### 6.8 RewardService
```
GET    /api/activities/:id/reward-rules        奖励规则列表
POST   /api/activities/:id/reward-rules        创建奖励规则（Admin）
PATCH  /api/reward-rules/:id                   编辑规则
POST   /api/rewards/trigger                    手动触发奖励（Admin）
GET    /api/users/:id/activity-points          积分流水（活动来源）
GET    /api/users/:id/badges                   用户徽章列表
```

奖励触发事件（内部事件总线，异步评估）：
```
application.approved
checkin.completed
task.completed
submission.approved
participation.completed
course.completed
project.completed
role.assigned
```

### 6.9 CertificateIntegrationService（复用现有 CertificateIssue 体系）
```
GET    /api/activities/:id/certificate-rules   证书触发规则
POST   /api/activities/:id/certificate-rules   配置证书规则（Admin）
POST   /api/certificates/generate              触发证书生成（异步）
GET    /api/certificates/:id                   获取证书
GET    /api/verify/:code                       公开验证（无需登录）
GET    /api/users/:id/certificates             用户证书列表
```

### 6.10 NotificationService
触发场景：
```
application.submitted   → 报名成功确认通知（用户）
application.approved    → 录取通知（用户）
application.rejected    → 审核结果通知（用户）
task.reminder           → 任务截止提醒（用户）
checkin.reminder        → 活动即将开始提醒（用户）
submission.reviewed     → 提交物审核结果（用户）
certificate.issued      → 证书已签发（用户）
activity.changed        → 活动变更通知（已报名用户）
```

---

## 七、Passport Timeline 集成规范

### 7.1 同步触发条件

`ActivityParticipation.status` 变为 `COMPLETED` 或 `CERTIFIED`，且 `passportSynced = false` 时，由后台 Job 定期批量写入 `PassportMilestone`。

### 7.2 Timeline Entry Payload（写入 PassportMilestone 时的完整字段）

```json
{
  "user_id": "uuid",
  "activity_id": "uuid",
  "activity_title": "string",
  "activity_type": "event|learning_experience|challenge|project|task|course",
  "role": "participant|speaker|learner|...",
  "start_time": "ISO8601",
  "end_time": "ISO8601",
  "points_earned": 100,
  "certificate_id": "uuid|null",
  "badge_ids": ["uuid"],
  "organizer_name": "string",
  "tags": ["climate_action", "youth"],
  "synced_at": "ISO8601"
}
```

写入后将 `ActivityParticipation.passportSynced` 设为 `true` 防止重复写入。

---

## 八、前端路由设计

### 8.1 用户端（基于现有 `[locale]` 路由结构）

```
/[locale]/activities                           活动列表/发现页
/[locale]/activities/[slug]                    活动详情页
/[locale]/activities/[slug]/apply              报名/申请页
/[locale]/activities/[slug]/workspace          参与工作台（登录后）
/[locale]/activities/[slug]/tasks/[taskId]     任务详情 + 提交

/[locale]/dashboard/my-activities              我的活动（10 Tab 工作台）
/[locale]/dashboard/certificates               我的证书（现有，复用）
/[locale]/dashboard/badges                     我的徽章（现有，复用）
/[locale]/dashboard/points                     我的积分流水
```

### 8.2 后台管理端（挂载在现有 `/[locale]/admin/` 下）

```
/[locale]/admin/activities                     活动列表
/[locale]/admin/activities/create              创建活动（6步引导）
/[locale]/admin/activities/[id]                编辑活动基本信息
/[locale]/admin/activities/[id]/applications   报名/申请审核
/[locale]/admin/activities/[id]/participants   参与者管理
/[locale]/admin/activities/[id]/tasks          任务与打卡管理
/[locale]/admin/activities/[id]/submissions    提交物审核
/[locale]/admin/activities/[id]/checkins       签到记录
/[locale]/admin/activities/[id]/rewards        积分/徽章/证书触发规则
/[locale]/admin/activities/[id]/analytics      数据统计

/[locale]/admin/activity-templates             类型与表单模板管理
/[locale]/admin/reviews                        全局审核中心
/[locale]/admin/activities-checkin             扫码签到（独立快速页，PWA）
/[locale]/admin/activity-organizers            机构与主办方管理
```

### 8.3 Admin Shell 菜单结构（完整 11 项）

对应英文原规范 Section 7 的 11 个菜单项：

```
◇ 活动中心 (Activity Center)
  1.  活动管理              /admin/activities
  2.  类型与模板管理         /admin/activity-templates
  3.  报名/申请管理          /admin/activities → [id]/applications（按活动进入）
  4.  参与者管理             /admin/activities → [id]/participants
  5.  任务与打卡管理          /admin/activities → [id]/tasks
  6.  提交物管理             /admin/activities → [id]/submissions
  7.  审核与评审中心          /admin/reviews
  8.  积分/徽章/证书规则      /admin/activities → [id]/rewards
  9.  签到与核验             /admin/activities-checkin（独立快速页）
  10. 数据统计              /admin/activities → [id]/analytics
  11. 机构与主办方管理        /admin/activity-organizers
```

---

## 九、前端页面组件结构

### 9.1 ActivityDetailPage（活动详情页统一壳）

```tsx
ActivityDetailPage
├── ActivityHero              // 封面图、标题、标签、状态徽标
├── ActivityMeta              // 日期、地点、主办方、容量
├── TypeSpecificContent       // 按 activity.type 动态渲染：
│     ├── EventContent        // 议程、嘉宾、场地地图
│     ├── LearningContent     // 课程大纲、导师、申请要求
│     ├── ChallengeContent    // 规则、排行榜、任务序列
│     ├── ProjectContent      // 背景、角色、里程碑
│     ├── TaskContent         // 任务说明、证明要求
│     └── CourseContent       // 章节、进度、测验
├── RegistrationPanel         // CTA：报名/申请/已报名状态
├── RewardPanel               // 可获积分/徽章/证书展示
└── RelatedActivities         // 推荐相关活动
```

### 9.2 My Activities（我的活动，10 Tab）

```
Tab 1:  已报名       (status=SUBMITTED)
Tab 2:  待审核       (status=PENDING_REVIEW)
Tab 3:  已录取       (status=APPROVED)
Tab 4:  进行中       (status=IN_PROGRESS / CHECKED_IN)
Tab 5:  待打卡       (IN_PROGRESS + 有 CHECK_IN 任务待完成)
Tab 6:  待提交       (IN_PROGRESS + 有 UPLOAD/REFLECTION 等任务待提交)
Tab 7:  已完成       (status=COMPLETED)
Tab 8:  已获得证书   (status=CERTIFIED)
Tab 9:  已获得徽章   (badgeAwardIds 非空)
Tab 10: 历史记录     (status=ARCHIVED)
```

每条记录显示字段：活动名称 / 活动类型（图标+标签）/ 我的角色 / 当前状态 / Next Action CTA / 获得积分 / 证书状态 / 徽章状态

### 9.3 参与工作台（/[locale]/activities/[slug]/workspace）

```
我的报名状态     报名/申请状态 + 审核进度
我的角色         我在本活动中的角色
我的任务         任务列表 + 完成进度
我的打卡         打卡历史 + 下次打卡 CTA
我的提交物       提交物列表 + 审核状态
我的反馈         导师/评审意见
我的积分         本活动获得的积分明细
我的证书状态     证书资格进度 + 下载入口
下一步该做什么   上下文感知的 Next Action 提示
```

### 9.4 签到扫码页（/[locale]/admin/activities-checkin）

扫码成功后显示：

```
✓ / ✗  签到状态（大字体，颜色区分）
用户名 + 头像
活动名称
报名角色
首次签到 / 重复签到 提示
操作按钮：[确认入场] [拒绝]

错误状态：
  - 未找到报名记录
  - 超出签到时间窗口
  - 已签到（重复）
  - 二维码已过期
  - 签名验证失败
```

---

## 十、后台管理设计

### 10.1 应合并的功能

| 功能 | 说明 |
|------|------|
| **活动创建入口合并** | 只保留一个 Create Activity 入口，第一步选类型，后续表单动态变化 |
| **报名管理合并** | 所有报名/申请进入统一 Applications，支持按活动类型筛选 |
| **参与者管理合并** | 所有参与者统一进入 Participants，可按活动/角色/状态筛选 |
| **审核中心合并** | 报名/提交物/打卡/证书/志愿时长审核统一进入 Review Center |
| **奖励规则合并** | 积分/徽章/证书/技能标签触发规则统一在 Rewards & Credentials 配置 |
| **表单模板合并** | 所有报名表/申请表/反馈表/提交表使用统一 Form Template Builder（JSON Schema-based） |

### 10.2 应分开的功能

| 功能 | 说明 |
|------|------|
| **活动类型配置分开** | Event/Learning/Challenge/Project/Task/Course 专属字段不同，独立表单 |
| **签到核验单独入口** | 扫码签到现场高频使用，独立 PWA 页面，要求快速稳定 |
| **Course 学习进度单独处理** | 课程进度/章节/测验/完课规则与普通报名分开，未来接外部 LMS |
| **Challenge 排行榜单独处理** | 涉及预计算和缓存，不与普通统计混合 |
| **Project 里程碑单独处理** | 独立 ProjectMilestone + ProjectDeliverable 管理 |

### 10.3 创建活动 6 步流程

```
Step 1: 选择活动类型（6 种类型卡片，含图标和说明）
Step 2: 基本信息（所有类型通用字段）
Step 3: 类型专属配置（基于 Step 1 选择的动态表单）
Step 4: 报名设置（表单模板、审核规则、容量）
Step 5: 奖励规则（积分/徽章/证书/技能标签触发）
Step 6: 预览 & 发布
```

### 10.4 全局审核中心 Tab 结构

```
全部审核
├── 报名审核      (objectType=APPLICATION)
│     详情面板：申请人资料 + 表单回答 + 申请角色
├── 提交物审核    (objectType=SUBMISSION)
│     详情面板：文件查看器 + 文本内容 + 任务上下文 + 评分量规
├── 手动签到核验  (objectType=CHECKIN)
│     详情面板：签到时间戳 + 位置信息 + 照片证明 + 用户详情
├── 证书资格      (objectType=CERTIFICATE_REQUEST)
│     详情面板：参与记录 + 任务完成度 + 证书模板预览
└── 志愿时长      (objectType=VOLUNTEER_HOURS)
      详情面板：时长记录 + 证明材料 + 组织确认
```

---

## 十一、六类活动优先级与核心能力

### 11.1 Event（活动）— 优先级：最高（P1）

**适用场景：** 上海气候周等会议活动

**核心能力：** 活动发布 / 报名 / 审核 / 二维码签到 / 参会角色 / 参会证书 / 照片资料关联

### 11.2 Task（任务）— 优先级：高（P1，作为所有类型的底层能力）

**定位：** 整个活动系统的底层能力，可被其他类型复用

**核心能力：** 单个任务发布 / QR 打卡 / 图片/文字/文件提交 / 审核 / 积分触发 / 连续打卡 / 嵌套子任务

### 11.3 Learning Experience（学习体验）— 优先级：高（P2）

**适用场景：** 夏校、游学、访问、青年项目

**核心能力：** 项目详情 / 项目申请 / 申请审核（含 INTERVIEW/OFFERED/WAITLISTED 状态）/ 录取管理 / 学习任务 / 成果提交 / 结业证书

### 11.4 Challenge（挑战）— 优先级：中（P3）

**适用场景：** Call for Action

**核心能力：** 挑战报名 / 任务列表 / 打卡 / 上传证明 / 个人/团队/学校/城市/机构排行榜 / 积分 / 徽章 / 优秀成果展示

**排行榜类型：** individual（个人榜）/ team（团队榜）/ school（学校榜）/ city（城市榜）/ organization（机构/企业榜）

**时间维度：** daily（日榜）/ weekly（周榜）/ all_time（总榜）

**技术要求：** 后台 Job 每 15 分钟预计算，缓存到 Redis，不实时计算

### 11.5 Project（项目）— 优先级：中（P3）

**适用场景：** 青年可持续行动项目、企业课题、城市实践

**核心能力：** 项目发布 / 角色申请 / 团队管理 / 阶段里程碑（ProjectMilestone）/ 成果提交（ProjectDeliverable）/ 导师评价 / 项目档案 / 项目完成证明

### 11.6 Course（课程）— 优先级：中（P3）

**适用场景：** 结构化课程

**核心能力：** 课程展示 / 报名选课 / 章节学习 / 学习进度 / 测验/作业 / 完课规则 / 证书触发 / 外部 LMS 同步

**P1 范围：** 只做课程记录和完成认证，不做完整 LMS 本体

---

## 十二、外部集成需求

### 12.1 外部 LMS 对接

Climate Passport **不是** LMS，只负责：学习身份 / 学习记录 / 完成状态（LMS webhook/API 回传）/ 证书/徽章/积分 / Passport Timeline 条目

支持对接：Tutor LMS / Moodle / 小鹅通 / 自建课程系统 / 第三方学习平台

### 12.2 证书区块链背书

- 已签发证书支持区块链背书（链上存证）
- 生成公开验证链接（不依赖平台即可核验真实性）
- Phase 1 先做链下验证码，Phase 3 实现链上背书

### 12.3 通知渠道

站内消息 / 邮件 / 短信 / 微信

---

## 十三、后台列表页通用能力规范

所有后台管理列表页（活动列表、报名列表、参与者列表、审核列表、签到记录等）**必须支持**：

- 分页（默认 20 条/页）
- 关键字搜索
- 按状态筛选
- 按活动类型筛选
- **CSV 导出**（全量或筛选后导出）

---

## 十四、开发阶段与里程碑

### Phase 1 — MVP（目标：支撑 SHCW2026 Event 场景）

**P1.1 数据层**
- [ ] Prisma schema 新增 12 个 Activity 系列模型 + 相关 enum
- [ ] 扩展 PointTransaction / PassportMilestone / QrToken 加 activityId
- [ ] Migration 1: `20260529000000_activities_core_schema`（Activity, ActivityDetail, ActivityRole, ActivityApplication, ActivityParticipation, ActivityFormTemplate）
- [ ] Migration 2: `20260529001000_activities_task_submission`（ActivityTask, ActivitySubmission, ActivityCheckinRecord）
- [ ] Migration 3: `20260529002000_activities_reward_review`（ActivityRewardRule, ActivityCertificateRule, ActivityReviewWorkflow）
- [ ] Migration 4: `20260529003000_extend_existing_for_activities`（现有 3 表加 activityId）

**P1.2 Event 类型完整流程**
- [ ] ActivityService：POST /api/activities + ActivityDetail(EVENT)
- [ ] ActivityService：GET /api/activities 列表（含 Event 类型筛选）
- [ ] ActivityService：GET /api/activities/:slug 详情
- [ ] ApplicationService：POST /api/activities/:id/apply + 审核流（approve/reject/waitlist）
- [ ] CheckinService：QR 生成 + HMAC 签名 + /api/checkin/verify
- [ ] ParticipationService：状态管理 + /api/participations/:id/sync-passport
- [ ] 后台：活动列表 / 创建（6步）/ 报名审核 / 参与者管理

**P1.3 用户端**
- [ ] 活动列表页（/[locale]/activities）
- [ ] 活动详情页（统一壳 + EventContent 渲染）
- [ ] 报名页
- [ ] 我的活动（Tab 1~4：已报名/待审核/已录取/进行中）

**验收标准：** Event 创建→发布→报名→审核→签到→Passport Timeline 全流程跑通

---

### Phase 2 — 核心引擎（目标：Task + Learning + 奖励闭环）

**P2.1 Task 子系统**
- [ ] ActivityTask CRUD + 嵌套子任务
- [ ] ActivitySubmission 提交 + 审核
- [ ] ActivityReviewWorkflow 全局审核中心（7 种审核方式）
- [ ] 参与工作台完整（/[locale]/activities/[slug]/workspace）

**P2.2 Learning Experience 类型**
- [ ] ActivityDetail(LEARNING) + 专属前端内容渲染
- [ ] 申请审核流扩展（INTERVIEW/OFFERED/WAITLISTED 状态）
- [ ] 学习工作台

**P2.3 奖励引擎**
- [ ] ActivityRewardRule 配置 UI
- [ ] 奖励触发逻辑（异步事件总线：application.approved 等 → points/badge/skill_tag）
- [ ] ActivityCertificateRule（复用现有 CertificateDefinition）
- [ ] 我的活动剩余 Tab（Tab 5~10）

**验收标准：** Learning 申请→录取→任务→提交→审核→证书→积分/徽章/技能标签完整

---

### Phase 3 — 全类型扩展

**P3.1 Challenge 类型**
- [ ] ActivityDetail(CHALLENGE) + 5 维排行榜（individual/team/school/city/organization）+ 3 个时间维度
- [ ] Redis 排行榜预计算（后台 Job 每 15 分钟）
- [ ] 连续打卡奖励逻辑

**P3.2 Project 类型**
- [ ] ProjectMilestone + ProjectDeliverable 表
- [ ] 里程碑管理 UI
- [ ] 导师评价流程（EXPERT 审核类型）

**P3.3 Course 类型**
- [ ] ActivityDetail(COURSE) + 课程结构
- [ ] 外部 LMS 对接框架（webhook 接收完课状态）
- [ ] Phase 1 先做记录+完成认证

**P3.4 证书区块链背书**
- [ ] 已签发证书链上存证
- [ ] 生成公开链上验证链接

**P3.5 历史数据迁移（现有 Event/Learning → Activity）**
- [ ] 迁移脚本：existing `Event` → `Activity(type=EVENT)` + `ActivityDetail`
- [ ] 迁移脚本：existing `Registration` → `ActivityApplication` + `ActivityParticipation`
- [ ] 迁移脚本：existing `LearningExperienceProgram` → `Activity(type=LEARNING)` + `ActivityDetail`
- [ ] 旧路由 301 重定向到新路由

**P3.6 管理后台完善**
- [ ] 全局审核中心（5个对象类型，含 volunteer_hours）
- [ ] 机构与主办方管理（/admin/activity-organizers）
- [ ] 数据统计分析

---

## 十五、关键实现约定

| 约定 | 说明 |
|------|------|
| **ID 格式** | 所有 ID 使用 UUID v4 |
| **时区处理** | 所有时间存储 UTC（TIMESTAMPTZ），前端用 Activity.timezone 字段换算展示 |
| **QR 安全** | 签到 QR payload 含 HMAC-SHA256 签名，服务端验证，防伪造；签到端点考虑 edge caching 保障高可用 |
| **签到页离线** | /admin/activities-checkin 按 PWA 设计，摄像头 + 离线缓存，现场稳定性优先 |
| **证书异步** | 触发证书生成后立即返回，PDF 生成异步，轮询或 webhook 回调 |
| **排行榜解耦** | Challenge 排行榜通过后台 Job 每 15 分钟预计算，缓存 Redis，不实时计算 |
| **奖励事件驱动** | 奖励触发通过内部事件总线异步执行，不在主请求路径同步运行 |
| **Passport Timeline** | passportSynced=false 的记录由后台 Job 定期同步写入 PassportMilestone |
| **文件存储** | Phase 1 复用现有文件方案，Phase 2 接入 S3/OSS 对象存储 |
| **现有表 Phase 1 不动** | Phase 1 完全不改动现有 Event/Registration/LearningExperience 表结构 |
| **Slug 生成** | 从 title 生成 URL-safe slug + 随机 4 位后缀，确保唯一 |
| **configJson 校验** | config_json / rule_json 等 JSONB 字段的结构合法性在服务层（不在 DB 层）校验 |
| **表单模板** | 使用 JSON Schema-based 表单构建器，不硬编码字段 |
| **CSV 导出** | 所有后台列表页支持筛选后 CSV 导出 |
| **区块链背书** | Phase 3 实现，Phase 1 先做链下验证码体系 |

---

*文档结束*
