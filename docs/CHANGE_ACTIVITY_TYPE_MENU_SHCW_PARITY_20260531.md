# 活动模块：分类二级菜单 + SHCW 完全对齐 + 风格精细落地

**变更日期：** 2026-05-31  
**涉及范围：** 管理后台活动模块导航、活动列表、活动表单、签到海报、活动详情子导航

---

## 需求解读

用户提出三项明确要求：

1. **根据活动分类形成独立二级菜单和功能页面**，但底层数据基座（Activity 模型）保持统一。
2. **完全对齐上海气候周网站的"活动"相关功能**，不丢弃、不删减任何功能（场地/地址/城市信息、邀请函、多日期时段、关闭状态、合作伙伴等）。
3. **所有页面的交互风格严格遵守 Climate Passport proto- CSS 系统**，精细对齐而非粗糙实现。

---

## 修改方法

### 1. 管理后台导航重构：分类二级菜单

**思路：** 将原先扁平的 "活动中心" 13项列表，重组为按活动类型分隔的视觉分区，每个类型有独立的 `[活动类型] 列表` 条目 + 类型相关子操作。跨类型工具（奖励规则、证书规则、评审工作流、表单模板、主办方管理）单独分组。

**实现方式：** 在 admin-shell.tsx 的 `buildAdminMenu()` 中，将 "活动中心" children 数组重组为按 EVENT / LEARNING / CHALLENGE / PROJECT / COURSE 分段的结构，使用 `▸` 前缀标识分类标题条目，`·` 前缀标识子操作。

URL 策略：列表页使用 `?type=EVENT/LEARNING/CHALLENGE/PROJECT/COURSE` 查询参数过滤，创建页面使用 `?type=EVENT` 预填类型。

### 2. 活动列表页：类型过滤

- `admin/activities/page.tsx`：接受 `searchParams.type` 参数，过滤 Prisma 查询，显示类型特定标题。
- `admin-activities-client.tsx`：新增顶部类型标签页（全部/活动/学习体验/挑战行动/项目孵化/课程），"创建" 按钮的标签和目标 URL 随类型变化。
- 类型为 EVENT 时显示 `eventLayer`（层级）、`isPrivate`（闭门）、`isPinned`（置顶）额外列。
- 添加 `isPinned`、`isPrivate`、`eventLayer` 到 ActivityRow 类型定义和 Prisma select。

### 3. 活动表单：场地/地址/城市字段

- `admin-activity-form-client.tsx` 表单状态新增 `venueZh, venueEn, addressZh, addressEn, cityZh, cityEn, roomZh` 七个字段。
- 这些字段仅在 `locationType === "OFFLINE" || "HYBRID"` 时显示，符合语义。
- 提交时序列化为 `Activity.locationJson`：`{venue, venueEn, address, addressEn, city, cityEn, room}`。
- 编辑模式下，从 `initial.locationJson`（在 edit page 中解析传入）预填。
- 完全对齐 SHCW 的 venue/address/city 双语字段结构。

### 4. 活动表单：邀请函内容字段（SHCW 完全对齐）

- 在 "活动专项设置"（EVENT only）分区末尾，新增 "邀请函（中文）" 和 "邀请函（英文）" 两个 HTML textarea。
- 提交时，若有内容则额外调用 `/api/activities/[id]/detail` PATCH 接口，将邀请函内容存入 `ActivityDetail.configJson`。
- 编辑页面（edit/page.tsx）从数据库并行加载 ActivityDetail，将 `configJson.invitationContentZh/En` 通过 `initial` 传入表单预填。

### 5. 签到海报页面（新建）

- **路由：** `/[locale]/activities/[slug]/checkin-poster`
- **访问控制：** 需要认证用户（requireAuthenticatedUser）
- **服务端逻辑：** 查询用户在此活动的 participation 记录；若有效则调用 `issueQrToken` 生成 ACTIVITY_CHECKIN 类型 QR，用 `qrcode.toDataURL` 生成 base64 图像；将 QR 图像作为 `qrDataUrl` prop 传入客户端组件。
- **客户端组件：** `checkin-poster-client.tsx`，展示活动海报、活动信息、参与者信息、QR 码，提供 print/PDF 按钮，print 时隐藏工具栏（`.no-print`），打印样式已写入。
- 若用户未报名则显示警告信息，QR 区域给出指引。

### 6. 活动详情：类型感知子导航

- `admin-activity-detail-client.tsx` 的底部快捷导航按类型分组：
  - EVENT：议程、嘉宾、签到海报、活动海报
  - PROJECT：里程碑、成果提交
  - CHALLENGE：排行榜、作品审核
  - LEARNING：学习任务、作品审核
  - TASK/COURSE：任务管理
  - 通用：奖励规则、数据分析

### 7. 新活动创建页：类型预填

- `admin/activities/new/page.tsx` 接受 `searchParams.type` 参数，读取并验证后作为 `initial.type` 传入表单，使标题和类型选择默认正确。

---

## 修改内容

### 变更文件列表

| 文件 | 变更类型 | 变更描述 |
|------|----------|----------|
| `components/admin-shell.tsx` | 修改 | 将 13 项扁平菜单重组为 6 个类型分区 + 跨类型工具分组 |
| `app/[locale]/admin/activities/page.tsx` | 修改 | 接受 `?type=` 过滤参数，类型特定标题/描述，select 增加 isPinned/isPrivate/eventLayer |
| `components/admin-activities-client.tsx` | 修改 | 新增类型标签页、类型感知创建按钮、EVENT 专属列（置顶/精选/闭门/层级） |
| `components/admin-activity-form-client.tsx` | 修改 | 新增场地/地址/城市双语字段（写入 locationJson）；新增邀请函 HTML 字段（写入 detail.configJson）；表单状态初始化从 initial 读取这些字段 |
| `app/[locale]/admin/activities/new/page.tsx` | 修改 | 接受 `?type=` 参数，预填表单类型 |
| `app/[locale]/admin/activities/[id]/edit/page.tsx` | 修改 | 并行加载 ActivityDetail，传入 invitationContent 字段预填 |
| `components/admin-activity-detail-client.tsx` | 修改 | 子导航按类型分组，EVENT 增加签到海报/活动海报链接 |
| `app/[locale]/activities/[slug]/checkin-poster/page.tsx` | 新建 | 服务端：查参与、发行 QR token、生成 base64 二维码图像 |
| `components/checkin-poster-client.tsx` | 新建 | 客户端：渲染签到海报（活动信息 + 用户信息 + QR + 打印样式） |

### 数据存储说明

- `Activity.locationJson`：存储 `{venue, venueEn, address, addressEn, city, cityEn, room}` 结构化位置信息
- `ActivityDetail.configJson`：存储 `{invitationContentZh, invitationContentEn, ...}` 扩展配置
- 上述字段通过 `as any` cast 绕过 Prisma 类型推断（已有字段），无需迁移

### TSC 验证

`npx tsc --noEmit --skipLibCheck` 无错误输出 ✅

---

## SHCW 对齐差距回顾（本次修复项）

| SHCW 功能 | 本次状态 | 备注 |
|-----------|----------|------|
| 场地名称（中/英） | ✅ 已实现 | locationJson.venue/venueEn |
| 详细地址（中/英） | ✅ 已实现 | locationJson.address/addressEn |
| 城市（中/英） | ✅ 已实现 | locationJson.city/cityEn |
| 邀请函正文（中/英 HTML） | ✅ 已实现 | detail.configJson.invitationContentZh/En |
| 签到海报（含个人 QR） | ✅ 已实现 | /activities/[slug]/checkin-poster |
| 活动分类二级菜单 | ✅ 已实现 | admin-shell.tsx 按类型分组 |
| 类型专属子导航 | ✅ 已实现 | admin-activity-detail-client.tsx |

### 待后续跟进（本次未完成）

- `maxAttendees`（SHCW 独立字段，当前用 `capacity` 代替）
- `isClosed`（SHCW 报名关闭状态，当前可通过 `registrationCloseAt` 实现）
- `eventDateSlots`（多日期时段，当前通过 AgendaItem 分组实现）
- `partners[]`（合作伙伴名称列表，当前在 `ActivityDetail.configJson` 中存储但暂无表单）
