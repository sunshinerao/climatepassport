# Climate Passport 成就 / 徽章体系实施蓝图（2026-05-26）

## 需求解读

本蓝图用于指导下一阶段开发，目标是将现有 climate-passport 中“积分阈值成就展示”的基础能力，升级为完整的“成就事实层 + 徽章授予层 + 可验证层”体系，并满足以下约束：

1. 数据结构新增/修改可落地、可迁移、可回滚，确保远端推送后无遗漏。
2. 页面新增/改造必须与现有全局风格、组件语义、模块边界保持一致，禁止独立另起一套视觉系统。
3. 采用分阶段增量改造，优先保证兼容现有功能（dashboard、certificate、profile、admin）。
4. 每个阶段都具备清晰的验收标准、回归测试和推送前检查清单。

---

## 修改方法

采用“分层设计 + 增量迁移 + 页面同构扩展”方法：

1. 分层设计：
   - Achievement（事实记录）
   - BadgeDefinition（规则/模版）
   - BadgeAward（授予实例）
2. 增量迁移：
   - 不破坏现有 `AchievementDefinition` 与 `UserAchievement` 逻辑，先并行新增模型与服务。
   - 完成验证后，再逐步将旧逻辑汇聚到新引擎。
3. 页面同构扩展：
   - 复用现有 Dashboard / Certificates / Admin 信息架构与样式 token。
   - 新页面按现有 feature-style 边界扩展，不创建“平行设计系统”。
4. 推送保障：
   - 每阶段要求 schema、API、页面、测试、文档、tracker 六项对齐后再推送。

---

## 修改内容

本次输出新增实施蓝图文档，覆盖数据库结构、API、页面、服务、测试和推送保障流程。

- 新增文档：
  - `docs/IMPLEMENTATION_BLUEPRINT_ACHIEVEMENT_BADGE_SYSTEM_20260526.md`

---

## 1. 当前基础能力盘点（已存在）

### 1.1 数据层

当前仓库已存在：

- `AchievementDefinition`
- `UserAchievement`
- 与证书定义的关联字段（`CertificateDefinition.achievementDefinitionId`）

可直接作为 Phase 1 的兼容基础，不需要清空重建。

### 1.2 服务层

当前已实现“积分阈值自动解锁成就”的逻辑，位于：

- `apps/passport-web/lib/server/platform-data.ts`

### 1.3 页面层

当前已具备：

- Dashboard 的成就卡片与统计位
- Climate Passport 页面的成就徽章展示位

后续应在这些入口上做“增强”，而不是改成全新孤立页面风格。

---

## 2. 目标架构（下一阶段）

```text
User Action/Event
-> Achievement Fact Record
-> Verification/Review
-> Badge Rule Evaluation
-> Badge Award
-> Public Verification + Dashboard/UI Exposure
```

分层职责：

1. Achievement：记录用户做过什么（事实）。
2. Badge：认可用户达到什么水平（身份资产）。
3. Verification：说明可信等级与可验证状态。

---

## 3. 数据库实施蓝图（Prisma）

## 3.1 新增/扩展枚举

新增枚举（与方案保持一致，必要时英文值不变）：

1. `AchievementType`
2. `AchievementStatus`
3. `AchievementVerificationLevel`
4. `AchievementSourceType`
5. `BadgeCategory`
6. `BadgeLevel`
7. `BadgeVerificationGrade`
8. `BadgeAwardStatus`

说明：若与现有 enum 名冲突，优先复用现有；若语义不完整，则在 migration 注释中给出映射策略。

## 3.2 新增模型

1. `Achievement`（事实实例表）
   - 关键字段：`userId`, `type`, `status`, `verificationLevel`, `sourceType`, `sourceId`, `points`, `skillTags`, `topicTags`, `sdgTags`, `evidenceJson`, `completedAt`
   - 索引建议：
     - `[userId, createdAt]`
     - `[type, status]`
     - `[verificationLevel]`
     - `[sourceType, sourceId]`

2. `BadgeDefinition`（徽章定义表）
   - 关键字段：`code`, `category`, `level`, `verificationGrade`, `criteriaJson`, `requiredPoints`, `isActive`, `displayOrder`
   - 索引建议：
     - `[code]` unique
     - `[isActive, displayOrder]`
     - `[category, level]`

3. `BadgeAward`（授予实例表）
   - 关键字段：`userId`, `badgeDefinitionId`, `status`, `awardedAt`, `verificationToken`, `relatedAchievementIds`, `evidenceSnapshotJson`
   - 索引建议：
     - `[userId, awardedAt]`
     - `[badgeDefinitionId, status]`
     - `[verificationToken]` unique

## 3.3 兼容策略（必须执行）

1. 保留现有 `AchievementDefinition` + `UserAchievement`（兼容现网逻辑）。
2. `UserAchievement` 在 Phase 1 仍可继续写入（避免中断当前 dashboard 展示）。
3. 新引擎上线后，逐步将“徽章授予依据”迁移到 `Achievement`。

## 3.4 Migration 执行顺序

1. 新增 enum 与新表（不删除旧字段）。
2. 生成迁移并在本地回放。
3. 增加 seed：
   - MVP 12 个徽章定义
   - 基础成就类型模板
4. 为已存在用户做一次可重入 backfill：
   - 从注册、签到、课程完成、证书签发中补录 Achievement。
5. 跑集成验证后再考虑淘汰旧路径。

## 3.5 回滚策略

1. migration 必须可逆（drop 新表不影响旧表）。
2. 业务开关：
   - `BADGE_ENGINE_ENABLED`
   - `ACHIEVEMENT_FACT_ENABLED`
3. 出现异常时先关开关，不立即删库结构。

---

## 4. 服务与规则引擎实施蓝图

## 4.1 目录建议

1. `apps/passport-web/lib/server/achievement-service.ts`
2. `apps/passport-web/lib/server/badge-service.ts`
3. `apps/passport-web/lib/server/badge-rule-engine.ts`
4. `apps/passport-web/lib/server/badge-verification.ts`

## 4.2 MVP 引擎能力（先做简化）

`checkBadgeEligibility(def, achievements, points)` 支持：

1. `minPoints`
2. `achievementType + minCount`
3. `minVerificationLevel`
4. `requiredSkillTags`（至少命中 N 条）

暂不做：

1. 全量 DSL 的深层嵌套表达式
2. 复杂时效续期
3. 跨机构多租户冲突治理

## 4.3 触发点（按现有流程接入）

在以下事件完成后调用 `evaluateBadgesForUser(userId)`：

1. 用户注册成功
2. 用户资料保存并达到完整度阈值
3. 活动报名成功
4. 活动签到成功
5. 学习项目完成
6. 证书签发成功
7. Admin 审核通过成就

---

## 5. API 实施蓝图

## 5.1 用户端 API（Phase 1 必做）

1. `GET /api/me/achievements`
2. `GET /api/me/badges`
3. `POST /api/me/achievements`

行为约束：

1. 用户自提成就默认 `PENDING_REVIEW` + `SELF_RECORDED`。
2. 返回结构保留分页字段，避免未来破坏兼容。

## 5.2 Admin API（Phase 1 必做）

1. 成就审核：list/create/update/approve/reject/revoke
2. 徽章定义：list/create/update/activate/deactivate
3. 徽章授予：list/manual-award/revoke

## 5.3 验证 API（Phase 1 必做）

1. `GET /api/verify/badge/:token`

公开返回最小披露：

1. `valid`
2. `badgeName`
3. `userDisplayName`
4. `issuerName`
5. `awardedAt`
6. `verificationGrade`
7. `status`

---

## 6. 页面实施蓝图（与现有风格统一）

## 6.1 用户侧页面

1. `/{locale}/dashboard/achievements`
   - Timeline + Cards
   - 筛选：type/status/verificationLevel

2. `/{locale}/dashboard/badges`
   - Badge Grid + Detail Drawer
   - 已获得/未获得分区

3. `/{locale}/verify/badge/[token]`
   - 与证书验证页同视觉语义（信任标记、最小披露、状态标签）

## 6.2 与现有页面联动

1. `/{locale}/dashboard/climate-passport`
   - 增加“最近成就”“最近徽章”“下一步建议”
2. `/{locale}/dashboard`
   - KPI 增加 `Active Badges` 和 `Verified Achievements`

## 6.3 Admin 页面

1. `/{locale}/admin/achievements`
2. `/{locale}/admin/badges/definitions`
3. `/{locale}/admin/badges/awards`

## 6.4 样式一致性硬约束（必须遵守）

1. 复用现有 `globals.css` token 与 feature CSS 边界，不新建独立 design system。
2. 字体、卡片、按钮、状态标签、顶部导航与现有 dashboard/admin 页面保持统一。
3. 仅在 `apps/passport-web/app/styles/features/` 下新增对应 feature 样式文件，并由现有入口引入。
4. 禁止卡通化徽章视觉；优先使用 credential/seal 风格。

---

## 7. 推送前“零遗漏”执行清单

每次推送必须同时检查以下 10 项：

1. `prisma/schema.prisma` 与迁移文件一致。
2. seed 数据包含新增枚举与 MVP 徽章定义。
3. 新 API 路由与权限中间件已接入。
4. 新页面路由已在 locale 结构下可访问。
5. 页面文案具备 zh/en（至少 fallback 完整）。
6. Dashboard 与 Climate Passport 入口链接可达。
7. `npm run build` 通过。
8. 目标测试通过（API + rule engine + page regression）。
9. 文档更新（本蓝图 + 变更记录 + tracker）。
10. `git diff --name-only` 核对包含 schema/migration/API/UI/tests/docs，确认无缺件。

---

## 8. 测试与验收蓝图

## 8.1 必测用例

1. 成就创建：用户自提成就进入 `PENDING_REVIEW`。
2. 审核流：approve/reject/revoke 状态流转正确。
3. 徽章授予：满足条件自动授予，不重复授予。
4. 徽章撤销：撤销后验证接口返回失效状态。
5. 公开验证：token 可验证，敏感信息不泄露。
6. 回归：证书模块、活动签到、profile 保存不回归。

## 8.2 工程验收标准

1. 类型检查零错误。
2. 引擎关键路径有单测覆盖。
3. API 行为有集成测试。
4. 页面关键交互有最小回归脚本。

---

## 9. 分阶段排期建议（2 周可交付版本）

## Week 1

1. Day 1-2：Prisma 增量模型 + migration + seed
2. Day 3-4：Achievement/Badge 服务 + 简化规则引擎
3. Day 5：用户 API + 验证 API

## Week 2

1. Day 1-2：用户页面（Achievements/Badges）
2. Day 3-4：Admin 基础管理页
3. Day 5：回归测试 + 文档收口 + 发布准备

---

## 10. 下一步执行任务单（可直接开工）

1. Task A：在 Prisma 中新增 Achievement / BadgeDefinition / BadgeAward 模型（保持旧模型兼容）。
2. Task B：实现 `evaluateBadgesForUser(userId)` 简化规则引擎并接入 7 个触发点。
3. Task C：实现用户端 API（me/achievements, me/badges, me/achievements POST）。
4. Task D：实现 admin 审核与徽章定义管理 API。
5. Task E：实现公开徽章验证 API + 页面。
6. Task F：实现 dashboard 入口增强与 Achievements/Badges 页面。
7. Task G：完成测试、文档、tracker 与推送前零遗漏核查。

---

## 11. 开发纪律（本项目约束）

1. 优先最小改动路径，禁止影响既有稳定证书/验证流程。
2. 所有新增字段/枚举必须在 migration 中显式声明。
3. 所有 API 必须包含权限校验和错误语义。
4. 所有页面改动必须复用现有全局风格和设计 token。
5. 每次提交必须附带文档更新与回归验证结果。
