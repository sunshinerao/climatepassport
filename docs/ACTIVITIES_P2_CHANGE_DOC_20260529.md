# P2 Activities Module — Change Documentation

## 需求解读
完成 Activities 模块 P2 阶段全部功能，包括：用户端参与流程（申请→工作台→任务→签到→提交）、QR 签到核验体系、奖励触发与护照同步、管理员扫码签到工具、CSV 导出。

## 修改方法
- 复用现有 CP CSS 类（`proto-page`、`proto-badge`、`proto-button` 等），不引入新样式框架
- 服务端数据获取 + 客户端交互组件（Client Components）分离
- 奖励触发 fire-and-forget 模式（不阻塞主流程）
- CSV 导出客户端实现（无服务端依赖，降低复杂度）

## 修改内容

### 新增文件

| 文件 | 说明 |
|------|------|
| `lib/server/activity-rewards.ts` | 奖励触发服务 + 护照同步助手 |
| `app/api/activities/[id]/checkin/qr/route.ts` | 生成 ACTIVITY_CHECKIN QR Token |
| `app/api/checkin/activity-verify/route.ts` | 管理员/核验员扫码验证端点 |
| `app/api/activity-participations/[id]/sync-passport/route.ts` | 手动触发护照时间线同步 |
| `app/api/activities/[id]/detail/route.ts` | 类型专项配置 GET/PATCH |
| `components/activity-apply-client.tsx` | 申请/报名表单客户端组件 |
| `components/task-submit-client.tsx` | 任务签到/提交客户端组件 |
| `components/activity-checkin-scanner-client.tsx` | 管理员 QR 扫码核验客户端 |
| `components/my-activities-client.tsx` | 我的活动多标签客户端 |
| `components/csv-export-button.tsx` | 通用 CSV 导出按钮组件 |
| `app/[locale]/activities/[slug]/apply/page.tsx` | 用户申请/报名页面 |
| `app/[locale]/activities/[slug]/workspace/page.tsx` | 参与者工作台页面 |
| `app/[locale]/activities/[slug]/tasks/[taskId]/page.tsx` | 任务详情+提交页面 |
| `app/[locale]/admin/activities-checkin/page.tsx` | 管理员现场扫码签到页面（PWA风格） |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `lib/server/qr.ts` | 添加 `activityId` 参数到 `issueQrToken` |
| `app/api/activity-applications/[id]/review/route.ts` | 审核通过时触发 `REGISTRATION_APPROVED` 奖励 |
| `app/api/activity-submissions/[id]/review/route.ts` | 审核通过时触发 `SUBMISSION_APPROVED` 奖励 |
| `app/api/activity-participations/[id]/route.ts` | COMPLETED/CERTIFIED 时触发奖励+护照同步 |
| `app/api/activity-checkin/route.ts` | 有效签到时触发 `CHECKIN_COMPLETED` 奖励 |
| `app/[locale]/activities/[slug]/page.tsx` | 添加 ActivityDetail 类型专项内容（Agenda/Venue/Curriculum/Rules）；报名按钮链接至 `/apply` 页面；已参与者显示工作台链接 |
| `app/[locale]/dashboard/my-activities/page.tsx` | 重构为多标签视图（全部/进行中/已申请/已完成/已获证书/已获徽章/已同步护照/历史），集成 next action CTA |
| `app/[locale]/admin/activities/applications/page.tsx` | 添加 CSV 导出按钮 |
| `app/[locale]/admin/activities/participations/page.tsx` | 添加 CSV 导出按钮 |
| `app/[locale]/admin/activities/checkin/page.tsx` | 添加 CSV 导出按钮 |

### Prisma/DB（前序 Session）
- 已完成 migration `20260528144150_activities_p2_qr_checkin_enum`：`ACTIVITY_CHECKIN` 加入 `QrTokenType` 枚举，`QrToken` ↔ `Activity` 关联

### TypeScript 验证
`npx tsc --noEmit` → **0 errors**
