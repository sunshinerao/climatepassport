# Activities Module — P2.3 & P3.1 开发记录

**日期**: 2026-05-29  
**涉及模块**: Activities — 奖励引擎 (P2.3) + Challenge 排行榜 (P3.1)

---

## 需求解读

### P2.3 — 奖励事件触发完善

开发计划 Phase 2.3 要求奖励引擎能够响应以下事件并自动发放奖励：
- `REGISTRATION_APPROVED`（报名审核通过）
- `CHECKIN_COMPLETED`（签到完成）
- `CONSECUTIVE_CHECKIN`（连续打卡）
- `SUBMISSION_APPROVED`（提交物审核通过）
- `TASK_COMPLETED`（任务完成）
- `PARTICIPATION_COMPLETED`（参与完成）

审查发现，前5个 trigger 已接通，但 **BADGE 奖励类型**在 `activity-rewards.ts` 中仅记录日志、未实际发放。同时 `TASK_COMPLETED` trigger 未在提交物审核通过时与任务绑定联动。

### P3.1 — Challenge 排行榜多维度

开发计划 Phase 3.1 要求排行榜支持：
- **5种维度**：individual / team / school / city / organization
- **3种时间周期**：all_time / weekly / daily
- Redis 预计算（15分钟后台 Job）

现有排行榜仅实现个人总榜，无维度切换、无时间筛选。Redis 预计算属于基础设施依赖项，暂不实现。

---

## 修改方法

### P2.3 — BADGE 奖励类型实现

在 `lib/server/activity-rewards.ts` 的 `applyRewardRule()` 函数中，为 `"BADGE"` case 添加实现：
1. 从 `rewardValueJson.badgeDefinitionId` 读取徽章定义 ID
2. 以 `rewardRuleId` 为 idempotency key 查重（通过 `evidenceSnapshotJson.rewardRuleId` 字段检索）
3. 创建 `BadgeAward` 记录
4. 将 award ID append 到 `activityParticipation.badgeAwardIds` 数组

### P2.3 — TASK_COMPLETED trigger

在 `app/api/activity-submissions/[id]/review/route.ts` 审核通过后，若 `existing.taskId` 不为空，额外触发 `TASK_COMPLETED` trigger（fire-and-forget，不阻塞响应）。

### P3.1 — 排行榜多维度

完整重写 `app/[locale]/activities/[slug]/leaderboard/page.tsx`：

- 读取 URL 参数 `?dim=individual|organization|country` 和 `?period=all_time|weekly|daily`
- 用 `proto-tab` / `proto-tab--active` 渲染两排 tab（维度 + 时间周期），tab 切换为 `<Link>` 跳转
- **individual + all_time**：读 `activityParticipation.pointsEarned`（已有）
- **individual + weekly/daily**：`pointTransaction.groupBy(userId)` 按 `createdAt >= since` 过滤，无需 Redis
- **organization**：`activityParticipation` → `User → Organization.name` join，JS 内聚合积分 + 人数
- **country**：`activityParticipation` → `User.country`，JS 内聚合
- 我的排名卡片仅在 individual 维度显示
- 跳过 team/school 维度（User/ActivityParticipation 模型无对应字段）

---

## 修改内容

### 文件 1：`apps/passport-web/lib/server/activity-rewards.ts`

**新增 BADGE case：**

```typescript
case "BADGE": {
  const badgeDefinitionId = typeof value.badgeDefinitionId === "string" ? value.badgeDefinitionId : null;
  if (!badgeDefinitionId) break;

  // 幂等查重
  const existing = await prisma.badgeAward.findFirst({
    where: { userId, badgeDefinitionId, evidenceSnapshotJson: { path: ["rewardRuleId"], equals: rule.id } },
    select: { id: true },
  });
  if (existing) break;

  const award = await prisma.badgeAward.create({
    data: {
      userId,
      badgeDefinitionId,
      evidenceSnapshotJson: { rewardRuleId: rule.id, activityId: rule.activityId },
    },
  });

  // 更新 participation.badgeAwardIds
  await prisma.activityParticipation.updateMany({
    where: { activityId: rule.activityId, userId },
    data: { badgeAwardIds: { push: award.id } },
  });
  break;
}
```

**位置**：插入到 `POINTS` case 之后，`PASSPORT_ENTRY` case 之前。

---

### 文件 2：`apps/passport-web/app/api/activity-submissions/[id]/review/route.ts`

**新增 TASK_COMPLETED trigger：**

```typescript
if (status === "APPROVED") {
  void triggerActivityRewards({ ... trigger: "SUBMISSION_APPROVED" });
  // 若绑定了具体任务，额外触发 TASK_COMPLETED
  if (existing.taskId) {
    void triggerActivityRewards({ ... trigger: "TASK_COMPLETED" });
  }
}
```

---

### 文件 3：`apps/passport-web/app/[locale]/activities/[slug]/leaderboard/page.tsx`

**完整重写**（207行 → 502行）：

| 新增能力 | 说明 |
|---------|------|
| 维度 tab | individual / organization / country，URL param `dim=` |
| 时间 tab | all_time / weekly / daily，URL param `period=` |
| 周/日榜 | 通过 `PointTransaction.groupBy` 按时间窗口计算 |
| 机构榜 | User → Organization join，JS 内聚合 |
| 国家/地区榜 | User.country 聚合 |
| 双语 | zh/en 所有 tab label 和 header |

---

## 未实现项（P3.1 留待后续）

| 项目 | 原因 |
|------|------|
| Team 维度 | ActivityParticipation 无 teamId，User 无 team 字段，需新增数据模型 |
| School 维度 | User 模型无 school 字段 |
| Redis 预计算 Job | 需引入 Upstash Redis + Vercel Cron，属基础设施层依赖 |

---

## TypeScript 验证

```
npx tsc --noEmit → Exit: 0
```
