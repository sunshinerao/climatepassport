# 变更文档：Activity EVENT 类型功能对齐

**日期**：2026-05-30  
**涉及模块**：活动模块（Activity Event）

---

## 需求解读

在已有 SHCW Events 平台的基础上，Climate Passport 的活动模块需要对 EVENT 类型实现完整功能对齐，包括：

- 活动议程（多日议程 + 日期Tab切换）
- 活动主持人 / 嘉宾管理
- 是否闭门会（isPrivate）
- 活动海报（posterImage）+ 海报打印页
- 分享二维码（基于 api.qrserver.com）
- 活动层次（eventLayer）、举办类型（hostType）、置顶（isPinned）
- 地图嵌入（mapUrl）
- 首页展示（isFeatured + isPinned 置顶横幅）
- 活动详情页（EVENT 专属分支）
- 报名后个人日程（dashboard my-activities 即将到来板块）
- 活动列表页升级（筛选Tab + 置顶横幅 + 类型徽章）

---

## 修改方法

1. **Schema + Migration**（前一会话完成）：在 Activity 模型添加新字段 + 新建 ActivityAgendaItem、ActivitySpeaker、ActivityWishlist 模型，并执行 Prisma migration。

2. **API 层**：新建专用路由处理议程、嘉宾、心愿单的 CRUD；更新现有 `/api/activities/[id]` PATCH 路由接受新字段。

3. **Admin 层**：活动表单增加 EVENT 专属字段 fieldset；新建议程管理页和嘉宾管理页（Server + Client 组件）。

4. **Public 层**：
   - 活动列表页：增加 Tab 筛选、置顶横幅、事件层次/闭门徽章
   - 活动详情页：EVENT 类型使用独立渲染分支（early return 模式）
   - 海报打印页
   - Dashboard 个人活动页增加"即将到来日程"板块

---

## 修改内容

### prisma/schema.prisma（前一会话）
- Activity 模型新增字段：`posterImage`, `highlights`, `highlightsEn`, `trackId`, `eventLayer`, `hostType`, `mapUrl`, `isPrivate`, `isPinned`
- 新建模型：`ActivityAgendaItem`, `ActivityAgendaItemSpeaker`, `ActivitySpeaker`, `ActivityWishlist`
- Back-relations 已同步到 Speaker, User, Track 模型

### API 路由（新建）
- `app/api/activities/[id]/agenda/route.ts` — GET（公开读）/ POST（管理员创建）
- `app/api/activities/[id]/agenda/[agendaId]/route.ts` — PATCH / DELETE
- `app/api/activities/[id]/speakers/route.ts` — GET / POST (upsert) / DELETE
- `app/api/activities/[id]/wishlist/route.ts` — POST（心愿单开关）

### API 路由（修改）
- `app/api/activities/[id]/route.ts`：PATCH 路由增加 EVENT 专属字段解构和写入（eventLayer, hostType, trackId, isPinned, isPrivate, posterImage, mapUrl, highlights, highlightsEn）；Prisma call 强转 `as any` 绕过类型推断

### Admin 组件（新建）
- `components/admin-agenda-client.tsx` — 议程 CRUD 客户端组件（按日期分组、多选嘉宾、ITEM_TYPES 类型选择）
- `components/admin-activity-speakers-client.tsx` — 嘉宾链接管理（add/remove/order）
- `app/[locale]/admin/activities/[id]/agenda/page.tsx` — 议程管理服务端页
- `app/[locale]/admin/activities/[id]/speakers/page.tsx` — 嘉宾管理服务端页

### Admin 组件（修改）
- `components/admin-activity-detail-client.tsx`：EVENT 类型时显示议程/嘉宾管理快速链接
- `components/admin-activity-form-client.tsx`：新增 EVENT_LAYERS / HOST_TYPES 常量；表单 state / payload 接入新字段；增加 EVENT 专属 fieldset（eventLayer, hostType, trackId, posterImage, mapUrl, highlights, isPinned, isPrivate）

### Public 页面（修改/新建）
- `app/[locale]/activities/page.tsx`：重写，Tab 筛选 + 置顶横幅 + posterImage 封面 + EVENT 类型徽章
- `app/[locale]/activities/[slug]/page.tsx`：重写，EVENT 类型独立分支（海报封面、议程 Tab、嘉宾网格、地图、心愿单、分享QR、海报链接）
- `app/[locale]/activities/[slug]/poster/page.tsx`（新建）：打印海报页，含 QR + 主办信息
- `components/event-detail-sections.tsx`（新建）：议程 Tab 客户端组件（按日分组、类型颜色编码）
- `app/[locale]/dashboard/my-activities/page.tsx`：增加"即将到来的活动日程"板块（EVENT + 未来时间 + 已报名）

---

## 技术备注

- Activity 模型无独立 `venue` 字符串字段，地点信息存于 `locationJson`（JSON）；涉及 venue 的代码均通过 `locationJson` 解析
- 新字段在 Prisma Client 类型中可能尚未完全生效，写操作使用 `as any` 转型规避
- TSC 验证通过（`npx tsc --noEmit --skipLibCheck` 无错误）
