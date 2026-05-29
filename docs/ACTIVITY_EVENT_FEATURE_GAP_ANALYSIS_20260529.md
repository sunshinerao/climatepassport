# Activity EVENT 类型 vs SHCW Event 功能差距分析
> 生成日期：2026-05-29  
> 依据：`prisma/schema.prisma`（Event 模型 + Activity 模型）、`admin-events-manager.tsx`、`platform-screens.tsx`、`verifier/scan/route.ts`

---

## 一、SHCW Event 完整功能清单

### 1.1 Event 数据模型字段
| 字段 | 说明 | Activity 对应 |
|------|------|--------------|
| title / titleEn | 中英文标题 | ✅ title / titleEn |
| description / descriptionEn | 中英文描述 | ✅ description / descriptionEn |
| shortDesc / shortDescEn | 摘要 | ✅ summary / summaryEn |
| highlights / highlightsEn | JSON 亮点数组 | ❌ **缺失** |
| startDate / endDate | 日期范围 | ✅ startTime / endTime (DateTime) |
| startTime / endTime | 时间字符串 | ✅ 通过 startTime/endTime DateTime |
| venue / venueEn | 场地中英文 | ✅ locationJson |
| address / addressEn | 地址 | ✅ locationJson |
| city / cityEn | 城市 | ❌ locationJson 中无标准 city 字段 |
| image | 封面图 | ✅ coverImage |
| partners / partnersEn | JSON 合作方 | ❌ partnerIds 只存 ID，无角色/名称/Logo |
| type | 活动类型字符串（Forum/Workshop 等） | ✅ category |
| **eventLayer** | 层级分类（COMPREHENSIVE/OFFICIAL/SIDE/FRINGE） | ❌ **缺失** |
| **hostType** | 主办类型（OFFICIAL/CO_HOSTED 等） | ❌ **缺失** |
| **trackId / Track** | 主题赛道关联 | ❌ **缺失** |
| managerUserId | 负责人 | ✅ organizerUserId |
| venueCheckinSecret | 场地 QR 签到密钥 | ✅ 通过 ActivityCheckinRecord + QrToken |
| **invitationContentHtml_zh/en** | 邀请函 HTML 内容 | ❌ **缺失** |
| maxAttendees | 最大人数 | ✅ capacity |
| requireApproval | 报名需审批 | ✅ requiresApproval |
| isClosed | 关闭报名 | ✅ status=CLOSED |
| isPublished | 已发布 | ✅ visibility/status |
| isFeatured | 精选 | ✅ isFeatured |
| **isPinned** | 置顶 | ❌ **缺失** |

### 1.2 Event 关联数据模型（子表/关系）
| 关联模型 | 说明 | Activity 对应 |
|---------|------|--------------|
| Registration | 报名记录（含 dietaryReq、checkedInAt、checkedInBy） | ✅ ActivityApplication + ActivityParticipation |
| CheckIn | 签到审计记录（scannedBy/method） | ✅ ActivityCheckinRecord |
| **EventDateSlot** | 多日期时间段（多天活动每天单独时间段） | ❌ **缺失**（Activity 只有 startTime/endTime） |
| **AgendaItem** | 议程条目，关联真实 Speaker 对象 | ❌ **仅有 configJson.agenda 纯文本** |
| **Speaker / SpeakerRole** | 嘉宾数据库，含机构、头像、专长标签 | ❌ **configJson 中仅有文本** |
| **Wishlist** | 收藏/心愿单 | ❌ **缺失** |
| **InvitationRequest** | 邀请函申请流程 | ❌ **缺失** |
| **SpecialPass** | 特殊通行证 | ❌ **缺失** |
| **EventVerifier** | 按活动指定验证员（非全局角色） | ⚠️ ActivityRole(VERIFIER) 存在但不是按活动指定 |
| **EventInstitution** | 联合主办/支持机构（含 logo、角色标签） | ❌ partnerIds 为 String[]，无结构化 |
| QrToken (EVENT_CHECKIN) | 用户自助生成签到 QR | ✅ /api/activities/[id]/checkin/qr |
| PassportMilestone | 关联护照里程碑 | ✅ 通过 rewardRules |
| PointTransaction | 积分流水 | ✅ 完整实现 |

### 1.3 SHCW Event 管理员功能
| 功能 | SHCW 实现位置 | Activity 对应 |
|------|-------------|--------------|
| 创建/编辑活动（含 eventLayer/hostType） | admin-events-manager.tsx | ✅ 但缺 eventLayer/hostType/trackId |
| 报名管理 + 审批 | ❌ SHCW 目前无单独注册管理页 | ✅ /admin/activities/[id] 有申请管理 |
| 签到扫码页（管理员端） | ❌ SHCW 无独立签到管理页 | ✅ /admin/activities/[id]/checkin |
| 验证员分配 | ❌ SHCW 无此 UI | ⚠️ ActivityRole 有但无专属页 |
| 指定活动负责人 | ✅ managerUserId | ✅ organizerUserId |
| 议程管理 | ❌ SHCW 无独立议程管理页 | ❌ 仅 configJson 文本 |
| 嘉宾管理 | ❌ SHCW 无独立嘉宾-活动绑定管理 | ❌ 缺失 |
| 机构合作方管理 | ❌ SHCW 无此 UI | ❌ 缺失 |
| 分析页 | ❌ | ✅ /admin/activities/[id]/analytics |
| 奖励规则管理 | ❌ | ✅ /admin/activities/[id]/rewards |
| 排行榜 | ❌ | ✅ /activities/[slug]/leaderboard |

### 1.4 SHCW Event 用户端功能
| 功能 | SHCW 实现 | Activity 对应 |
|------|---------|--------------|
| 活动列表（分类过滤） | events-filterable-grid.tsx | ✅ /activities（无分类过滤） |
| 议程展示（关联嘉宾姓名） | platform-screens EventsScreen | ⚠️ 仅 configJson 文本 |
| 签到 QR 生成 | /api/qr/event-checkin | ✅ /api/activities/[id]/checkin/qr |
| 验证员扫码 | /api/verifier/scan（IDENTITY+EVENT_CHECKIN） | ✅ 通过 verifier-scanner.tsx |
| 心愿单/收藏 | Wishlist 模型 | ❌ 缺失 |
| 邀请函申请 | InvitationRequest | ❌ 缺失 |
| 签到成就/积分 | createAchievementRecord + 30分 | ✅ rewardRules（触发器更灵活） |
| 仪表盘我的报名 | dashboard + Registration | ✅ my-activities + ActivityParticipation |

---

## 二、差距优先级分类

### P0 — 高价值、可独立实现（推荐优先）
1. **eventLayer + hostType 字段**：在 Activity 模型加两个枚举字段（或存入 configJson），管理表单暴露下拉选择。影响：活动列表过滤、分类展示。
2. **trackId 关联**：关联现有 Track 模型，展示活动赛道（颜色/图标）。
3. **highlights JSON 字段**：在 Activity 加 `highlights Json?`，管理表单支持输入，详情页展示亮点列表。
4. **isPinned 字段**：加入 Activity 模型，活动列表排序优先置顶。
5. **EventInstitution 结构化**：将 `partnerIds String[]` 升级为 `ActivityInstitution` 关联表（含机构ID、角色标签、logo、排序）。

### P1 — 中优先级，需新模型（较大改动）
6. **EventDateSlot → ActivityDateSlot**：新增 `ActivityDateSlot` 模型（activityId, scheduleDate, startTime, endTime），支持多日活动每天独立时段。管理表单支持多日期段添加。
7. **AgendaItem 升级**：新增 `ActivityAgendaItem` 模型，与现有 Speaker 表关联（或存嘉宾快照 JSON）。管理页面支持议程条目 CRUD + 嘉宾绑定。
8. **Wishlist for Activities**：新增 `ActivityWishlist` 表（userId, activityId），用户端"收藏活动"按钮。

### P2 — 低优先级 / 场景限定
9. **invitationContentHtml**：正式邀请函 HTML 内容，配合 InvitationRequest 工作流。
10. **InvitationRequest for Activities**：邀请函申请流程（填写嘉宾信息 → 提交 → 审批 → 生成邀请函）。
11. **SpecialPass for Activities**：特殊通行证系统（较复杂）。
12. **per-Activity EventVerifier**：将 ActivityRole VERIFIER 类型加上"指定到具体活动"的关系，并在管理页面提供分配 UI。

---

## 三、已有优势（Activity 强于 SHCW Event）

Activity 模块在以下方面**远超**原 SHCW Event：
- **奖励引擎**：支持 POINTS/BADGE/PASSPORT_ENTRY 三种奖励类型、6 种触发器
- **任务/提交**：Task → Submission → Review 工作流
- **排行榜**：3 维度 × 3 时间段
- **证书规则**：ActivityCertificateRule 可按条件颁发证书
- **项目里程碑**：ProjectMilestone 进度追踪
- **分析页**：参与人数、积分分布等统计

---

## 四、建议实施顺序

```
Phase A（当前 Sprint）
  A1. 模型扩展：Activity 加 eventLayer + hostType + isPinned + highlights 字段
  A2. 管理表单：EVENT 类型显示 eventLayer/hostType/trackId 额外字段
  A3. 活动列表：按 eventLayer/track 过滤，置顶排序

Phase B（下一 Sprint）
  B1. ActivityDateSlot 模型 + 管理 UI + 详情页多日议程展示
  B2. ActivityAgendaItem 模型 + 嘉宾绑定 + 详情页真实议程
  B3. ActivityInstitution 结构化 + 详情页合作方展示

Phase C（条件允许时）
  C1. Wishlist for Activities
  C2. per-Activity Verifier 分配 UI
  C3. InvitationRequest for Activities
```

---

## 五、SHCW Event 代码引用速查

| 文件 | 说明 |
|------|------|
| `components/admin-events-manager.tsx` | 管理员创建/编辑活动组件（带 eventLayer/hostType 表单） |
| `lib/server/admin-events.ts` | Zod schema + write/serialize helpers |
| `app/[locale]/admin/events/page.tsx` | 管理员活动列表页（ADMIN + EVENT_MANAGER 双角色） |
| `app/api/admin/events/route.ts` | GET 列表 + POST 创建 |
| `app/api/admin/events/[id]/route.ts` | PATCH 编辑（带角色校验） |
| `app/api/qr/event-checkin/route.ts` | 用户生成 QR 签到令牌 |
| `app/api/verifier/scan/route.ts` | 验证员扫码（IDENTITY + EVENT_CHECKIN，含 canVerifyEvent 权限检查） |
| `lib/server/platform-data.ts` @ `getEventsPageData` | 公开活动列表数据加载（含议程、签到流水） |
| `components/platform-screens.tsx` @ `EventsScreen` | 公开活动列表渲染（卡片 + 议程 + 往期） |
| `components/events-filterable-grid.tsx` | 可过滤活动卡片网格 |
| `prisma/schema.prisma` @ Event (line 446) | 完整 Event 数据模型 |
| `prisma/schema.prisma` @ AgendaItem (line 683) | 议程条目（关联 Speaker） |
| `prisma/schema.prisma` @ EventDateSlot (line 544) | 多日期时段 |
| `prisma/schema.prisma` @ EventInstitution (line ~515) | 机构合作方关联 |
| `prisma/schema.prisma` @ EventVerifier (line ~528) | 按活动分配验证员 |
| `artifacts/shcw-core-extract/events.json` | SHCW 真实活动数据（可用于参考字段使用情况） |
