# CHANGE_POINTS_AND_LEARNING_HOURS_UNIFICATION_20260526

## 需求解读

根据用户确认，继续落地此前建议，目标是统一并修正 Climate Passport 的两条核心机制：

1. 积分机制统一到账口径，避免“成就里有分、用户总分不变”的口径分裂。
2. 学习时长改为真实数据计算，覆盖活动与学习项目，移除硬编码静态兜底值。

## 修改方法

1. 新增积分账本服务，封装“用户积分增加 + 积分流水写入 + 幂等保护”，作为统一入口。
2. 在成就写入链路接入该服务：
- 新建且已批准的成就按分值自动入账。
- 管理端审批成就时，若有分值也可入账（幂等防重复）。
3. 学习项目完成发分改为调用统一积分服务（保留原有 participation.pointsAwarded 防重语义）。
4. 学习时长改为：
- 活动签到后 ATTENDED 的时长累计
- 已完成学习项目时长累计（优先配置 hours，缺省时按起止时间差）
- 最终合并后展示，不再使用静态 42 小时兜底。

## 修改内容

1. 新增统一积分服务
- 文件：`apps/passport-web/lib/server/point-ledger.ts`
- 提供 `grantUserPoints`：
  - 支持传入 Prisma client / transaction client
  - 幂等键防重复入账
  - 原子写入 users.points 与 point_transactions

2. 成就链路接入积分到账
- 文件：`apps/passport-web/lib/server/achievement-badge.ts`
- 在 `createAchievementRecord` 中：
  - 当成就状态为 APPROVED 且 points > 0 时，调用 `grantUserPoints`
  - 幂等键：`achievement:<achievementId>`

3. 管理端成就审批接入积分到账
- 文件：`apps/passport-web/app/api/admin/achievements/[id]/approve/route.ts`
- 审批后如 points > 0，调用 `grantUserPoints`（同幂等键）

4. 学习项目完成发分改造为统一入口
- 文件：`apps/passport-web/app/api/admin/learning-experiences/applications/[id]/status/route.ts`
- 用 `grantUserPoints` 替换手工 `user.update + pointTransaction.create`
- 幂等键：`learning-experience:<participationId>`

5. 学习时长计算口径修正
- 文件：`apps/passport-web/lib/server/platform-data.ts`
- 新增 `parseLearningHours` 辅助函数
- 用户查询增加 `learningExperienceParticipations`（COMPLETED）
- 计算逻辑：
  - `learningHoursFromEvents`（ATTENDED 活动时差）
  - `learningHoursFromPrograms`（programConfigJson 的 hours 字段优先，缺省再按 started/completed/cohort 时差）
  - 展示值改为两者求和后四舍五入
- 移除登录用户场景下对 `accountSnapshotByLocale.learningHours` 的 42 小时回退

6. 测试兼容修复
- 文件：`tests/certificate-issuance-routes.test.mjs`
- 为新引入模块 `@/lib/server/point-ledger` 补充测试 mock，保证 VM 路由加载正常。

7. 验证结果
- `npm run build` 通过。
- `npm test` 通过（38/38）。