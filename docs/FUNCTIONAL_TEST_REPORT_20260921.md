# Climate Passport 全功能测试报告（浏览器 + 接口）

- 报告日期：2026-09-21
- 被测环境：本地隔离测试环境（`scripts/run-with-test-env.mjs`），`http://127.0.0.1:3100`
- 数据库：`climatepassport_test`（隔离测试库，全程未触碰开发库）
- 邮件通道：`MAIL_TRANSPORT="test-outbox"`（未读取任何 dev/prod 邮件密钥）
- 改动状态：全部改动仅存在于工作区，**未提交、未推送、未执行任何 migration、未部署**

---

## 1. 测试账号与登录凭据

所有账号密码统一为 **`seeded-password`**（由 `prisma/seed.mjs` 的 `hash("seeded-password", 10)` 写入）。

| 角色 | 邮箱 | 密码 | 登录后落地页 | 后台可见性 |
| --- | --- | --- | --- | --- |
| ADMIN | `ops.admin@climatepass.org` | `seeded-password` | `/en/admin/events` | 全量后台 |
| EVENT_MANAGER | `events.manager@climatepass.org` | `seeded-password` | `/en/admin/events` | 仅自有活动/事件 |
| VERIFIER | `verifier.field@climatepass.org` | `seeded-password` | `/en/dashboard/climate-passport` | 验证者控制台 |
| ATTENDEE | `lin.qiao@climatepass.org` | `seeded-password` | `/en/dashboard/climate-passport` | 无 |
| ORGANIZATION | `partnerships@futurecitylab.org` | `seeded-password` | `/en/dashboard/climate-passport` | 无（机构身份走 `InstitutionRepresentation`） |

五个账号本轮均已实测可登录（`POST /api/auth/login` 返回 200 与上表 `redirectTo`）。

补充说明：
- `ORGANIZATION` 只是注册时带机构名的用户角色，代码中**没有**任何针对该角色的专属权限门；机构侧的真实权限来自 `InstitutionRepresentation` 的 `actionScope ⊆ {READ, WRITE, MANAGE}`。
- 特殊通行证的签发角色为 `SPECIAL_PASS_MANAGER`，核销角色为 `VERIFIER`/`EVENT_MANAGER`/`ADMIN`。

---

## 2. 本轮通过验证的功能

### 2.1 前台（用户侧）

| 功能 | 角色 | 验证方式 | 结果 |
| --- | --- | --- | --- |
| 注册 / 登录 / 会话保持 | 全部 | UI + `/api/auth/login` | 通过 |
|  Climate Passport 首页（积分、徽章、身份二维码） | ATTENDEE/ORGANIZATION | UI 快照 | 通过 |
| 资料维护 Basic（电话/国家/头像/简介） | ORGANIZATION | UI 填写并保存 → 查库 | 通过（`bio`、`phone` 落库） |
| 资料维护 Professional（职称/机构名/官网/简介） | ORGANIZATION | UI 保存 → 查库 | 通过（`users.title` + `organizations` 按 `userId` upsert） |
| 资料维护 Security（改密） | ORGANIZATION | 错误原密码提交 | 通过（前端提示 "Current password is incorrect."，未改密） |
| 姓名/邮箱只读约束 | 全部 | UI 检查 | 通过（`disabled`，服务端亦不接受） |
| 活动浏览 / 详情 / 申请 | ATTENDEE | UI 提交申请 | 通过（修复后跳转正确，见 4.1） |
| 活动社区发帖 / 评论 / 举报 | ATTENDEE | API + UI | 通过（普通用户内容为 PENDING） |
| 任务自助签到 | ATTENDEE | `/api/checkin` | 通过（VALID 记录 + 参与状态迁移） |
| 个人二维码签发 → 他人核销 | ATTENDEE→VERIFIER | 签发 + 扫码 | 通过（重复扫码返回 `already_checked_in`） |
| 站内消息（工单提交） | ADMIN | UI 表单提交 | 通过（提示 "Message submitted." + `contact_messages` PENDING 落库） |
| 证书公开核验 | 匿名 | `/en/verify?code=…` → `/en/verify/certificate/{code}` | 通过（有效态 ✓、撤销态 ✕、Passport ID 脱敏为 `AB••••9KX`、完整性 "Intact"） |
| 档案（Portfolio）五维视图 | ADMIN | UI | 通过（Learning/Action/Innovation/Organization/Influence + `Rule version 1`） |
| 档案分享同意 → 建链 → 公开页 | ADMIN | UI 全链路 | 通过（见 2.3） |
| 无 `code` 时 `/en/verify` 回落首页 | 匿名 | UI | 通过（设计如此，非缺陷） |

### 2.2 后台（管理侧）

| 功能 | 角色 | 结果 |
| --- | --- | --- |
| 运营台导航与角色门 | ADMIN/EVENT_MANAGER | 通过（ORGANIZATION 访问 `/en/admin/*` 被重定向离站） |
| 事件新建（全字段表单 + 落库） | ADMIN | 通过（`events` 新增行，且新事件即时出现在验证者控制台的活动范围下拉） |
| 事件列表 / 编辑器 | ADMIN | 通过 |
| 证书仪表盘（总量/本月/待审/模板统计） | ADMIN | 通过 |
| 证书记录列表（状态/分类筛选、分页） | ADMIN | 通过（317 条、状态计数正确） |
| 证书撤销 → 恢复闭环 | ADMIN | 通过（UI 按钮 → 状态 `ISSUED→REVOKED→ISSUED`，`revocationReason` 与 `restoredAt` 均正确落库） |
| 活动中心（500 活动 / 469 已发布的统计与分型导航） | ADMIN | 通过 |
| 验证者控制台（手动令牌核销） | ADMIN | 通过（身份码 `V1I-…` → "Identity verified / valid"，含审计落库） |
| 系统设置 · 性能诊断 | ADMIN | 通过（Run diagnostics 实测 TTFB 136 ms 并分栏展示） |
| 活动社区审核队列（版主视角） | ADMIN | 通过（修复后，见 4.5/4.6） |
| 批量审核 / 出席补录 / 奖励规则 / 证书规则 | ADMIN | 通过（接口层，早前轮次验证） |

### 2.3 权限矩阵（越权必须被拒）

| 场景 | 期望 | 实测 |
| --- | --- | --- |
| EVENT_MANAGER 修改自有活动/任务/期次 | 200 | 通过 |
| EVENT_MANAGER 修改他人活动 | 403 | 通过 |
| ADMIN 为他人直接生成签到二维码 | 403（应由本人签发） | 通过 |
| ATTENDEE 列出活动申请列表 | 403 | 通过 |
| ATTENDEE 访问 `/api/verifier/scan` | 401/403 | 通过 |
| ORGANIZATION 访问 admin/verifier 接口 | 403 | 通过 |
| 扫码 `eventId` 与令牌所属活动不一致 | 409 `wrong_event` | 通过 |
| 扫码未知/失效令牌 | 404 `invalid` | 通过 |
| PROJECT 申请未带明示同意、由他人代交 | 403 | 通过（同意策略 `PROJECT_APPLICATION_CONSENT_V1` 生效） |
| 分享链接字段超出同意范围 | 修复后 400/收敛 | 见 4.8 |

---

## 3. 发现并修复的缺陷（共 9 处，均已重跑通过）

### 3.1 活动申请成功后跳转到 404
- **症状**：用户在 `/en/activities/{slug}/apply` 提交成功，页面却跳到不存在的路径。
- **根因**：`activity-apply-client.tsx` 用 `activityId` 拼详情链接，而详情页是 **slug 路由**。
- **修复**：`apply/page.tsx` 透传 `activitySlug`，客户端改为按 slug 跳转。
- **证据**：重跑后提交成功且落地活动详情页。

### 3.2 活动海报页打印按钮导致服务端渲染异常
- **症状**：访问 `/en/activities/{slug}/poster` 时报 `window is not defined`（即此前你贴出的截图 TypeError）。
- **根因**：在服务端组件里内联写了 `onClick={() => window.print()}`。
- **修复**：抽出客户端组件 `components/poster-print-button.tsx`，海报页改为引用它。
- **证据**：海报页 200 正常渲染，打印按钮可用。

### 3.3 非法 `taskType` 返回 500 空响应体
- **症状**：`POST /api/activity-tasks`、`PATCH /api/activity-tasks/{id}` 传枚举外的 `taskType`，得到 HTTP 500 且无错误信息（Prisma 校验异常直接冒泡）。
- **修复**：以 `Object.values(ActivityTaskType)` 做白名单校验，返回 400 与可选值列表。
- **证据**：重跑返回 `400 Invalid taskType. Expected one of: CHECK_IN, UPLOAD, QUIZ, REFLECTION, ATTENDANCE, SHARE, SURVEY, LEARNING_UNIT, PROJECT_MILESTONE, TEAM_ACTION`。

### 3.4 EVENT_MANAGER 无法为参与者代建活动申请
- **症状**：管理员/活动负责人代用户创建申请被误拒。
- **修复**：`activity-applications/route.ts` 区分「自助提交」与「管理端代提交」两条路径，代提交仍受 `canManageActivity` 约束。
- **证据**：EVENT_MANAGER 为他人建申请 201；跨活动越权仍 403。

### 3.5 版主看不到任何待审社区内容
- **症状**：`GET /api/activities/{id}/community` 对 ADMIN/组织者返回的帖子与评论队列恒为空，PENDING 内容不可见 → 审核无法进行。
- **根因**：`where: { OR: moderator ? [{}] : [...] }`。**Prisma 中 `OR: [{}]` / `OR: []` 匹配的是「零行」而不是「全部行」**（已用最小复现脚本证实）。
- **修复**：版主场景直接省略该过滤条件。
- **证据**：ADMIN 侧同一次请求可见 `PENDING` 帖子与其 PENDING 评论，审核后可变 PUBLISHED。

### 3.6 版主对任何帖子评论都 404
- **症状**：`POST …/community/posts/{postId}/comments` 对版主一律 404。
- **根因**：与 3.5 同一 `OR: [{}]` 反模式。
- **修复**：同上，版主跳过可见性过滤。
- **证据**：ADMIN 评论 201；普通用户评论自己的 PENDING 帖 201；评论 REJECTED 帖仍 404（正确）。

> 附带结论：`ocr` 审查工具对该模式的判读（认为 `OR: [{}]` 等于放开全部）**语义相反**，实际是收紧到零行。已修复项均为实测确认，未采信工具单方结论。

### 3.7 `db:sync && db:seed` 后环境缺少档案规则基线
- **症状**：新初始化环境中 `POST /api/admin/portfolio/rules` 永远过不了 `dimensionKey` 校验，档案规则集无法创建，`/en/dashboard/portfolio` 无维度。
- **根因**：`prisma/seed.mjs` 的 `resetDatabase()` 会清空 `competency_dimension` / `portfolio_rule_set` / `portfolio_evidence_rule`，而这些行由 migration 静态写入且不再恢复。
- **修复**：新增 `restorePortfolioStaticBaseline()`，按 migration 原值 upsert 回 5 个能力维度、v1 规则集与 5 条证据规则（纯代码修复，**未执行任何 migration**）。
- **证据**：UI 五维正常显示 `Rule version 1`；规则集接口可读写（现库中存在由浏览器创建的 `E2E browser ruleset` v2 DRAFT）。

### 3.8 档案分享政策确认框默认预勾选（同意合规）
- **症状**：`/en/dashboard/portfolio` 的「我确认分享政策版本 portfolio-sharing-v1」在进入页面时即为勾选态。
- **根因**：组件初始 state 与 `GET /api/me/portfolio/consent` 无记录时的兜底响应都写死了 `policyVersion: PORTFOLIO_POLICY_VERSION`；而服务端只校验该值是否等于当前版本，因此无法区分「用户主动确认」与「默认带过」。这与 `docs/PORTFOLIO_SHARING_PRIVACY_NOTICE.md` 声明的「明示确认」相悖。
- **修复**：无存储记录时兜底 `policyVersion: ""`，组件初始值同步置空。
- **证据**：
  - 未勾选直接保存 → 明确拒绝："Select at least one field and acknowledge the policy version."
  - 用户主动勾选后保存 → "Sharing settings saved."，库中 `mode=PUBLIC_PROFILE, fieldAllowlist={name}, policyVersion=portfolio-sharing-v1`。

### 3.9 分享链接可越出同意范围披露字段（过度披露）
- **症状**：`POST /api/me/portfolio/share-links` 完全信任请求体的 `fieldAllowlist`，且从不校验当前同意状态。
  1. 同意只勾 `title` 时，直接调接口用 `["name","title","dimensions","evidence"]` 建链，公开页会**按链接字段投影**（解析器读的是 `link.fieldAllowlist`），从而披露用户从未同意的维度与证据摘要；
  2. 处于 `PUBLIC_PROFILE` 甚至 `PRIVATE` 也能建链，但解析器要求 `consent.mode === "DIRECT_SHARE"`，于是 UI 给出的「一次性令牌」必然 404（本轮实测复现）。
- **修复**：
  - 服务端建链前校验存储同意：必须存在、`ACTIVE`、`mode === DIRECT_SHARE`、政策版本匹配且未过期，否则 403；
  - 链接字段与 `consent.fieldAllowlist` **取交集**，交集为空则 400；审计日志记录实际生效字段；
  - 前端仅在 `DIRECT_SHARE` 下展示「创建 7 天分享链接」按钮。
- **证据**：
  - `PUBLIC_PROFILE` 下建链 → `403 Direct share consent is required before creating a link.`
  - 同意为 `{title}` 时请求 4 个字段 → 落库 `fieldAllowlist: ["title"]`
  - UI 建链 → 打开 `/en/portfolio/{token}` → 仅渲染 "Platform Operations Lead"（无姓名、无维度），`accessCount` 由 0 变 1。

---

## 4. 决策项落地情况（2026-09-21 你已逐条拍板）

原第 4 节列出的是「已确认但未修复」事项。你逐条给出决策后，本轮已按「由小到大：2 → 5 → 3 → 4 → 1」的顺序落地，每步都跑类型检查 + 单测。当前状态：

| # | 决策 | 状态 | 落地内容 |
| --- | --- | --- | --- |
| 2 | `PUBLIC_PROFILE` **移除该选项**，不凭空做公开档案页 | ✅ 已完成 | 同意白名单收紧为 `PRIVATE` / `DIRECT_SHARE`（`app/api/me/portfolio/consent/route.ts`），前端单选框同步删除该项，建链按钮仅在 `DIRECT_SHARE` 时可用。DB 枚举值保留，历史行读作「未选中」，由属主重新选择。 |
| 5 | 建链响应**收紧字段** | ✅ 已完成 | `POST /api/me/portfolio/share-links` 只回 `id / token / expiresAt / accessCount / maxAccessCount / status`，不再回传整行（`tokenHash`、`userId` 均不出现在响应中）。 |
| 3 | 客服工单**建最小后台收件箱 + 回复** | ✅ 已完成 | 新增 `lib/server/support-tickets.ts`（纯函数状态机）+ `GET /api/admin/messages`（状态/类别/关键词筛选与计数）+ `PATCH /api/admin/messages/[id]`（回复、备注、关闭）+ `/[locale]/admin/messages` 页面与管理端导航项。规则：`PENDING→REPLIED→CLOSED`，回复必填才能 `REPLIED`，`CLOSED` 只读，不回填 `PENDING`；处理动作与拒绝原因都写审计。新增 8 条单测 + 7 条接口用例。 |
| 4 | 原生弹窗**只改带数据录入的**，纯确认保留 `window.confirm` | ✅ 已完成 | 见下方 4.1。 |
| 1 | JSON 接口鉴权失败形态**分批迁移**为 401/403 | ✅ 两批全部完成 | 见下方 4.2。**104 个 `route.ts` / 143 个调用点**已全部改用 API 守卫（第 1 批 54 文件 68 点 + 第 2 批 50 文件 75 点），`app/api/**` 中页面式助手调用点归零；页面侧 67 个 `page.tsx` / `layout.tsx` 按决策全部保留 `redirect()`。 |
| 6 | 测试库数据噪声**保留现状** | ✅ 按决策不处理 | 未重置 `climatepassport_test`；本轮新增的测试数据见第 5 节末尾。 |

### 4.1 录入类弹窗改造（决策 4）

新增可复用组件 `components/prompt-dialog.tsx`：`usePromptDialog()` 返回 `(ask, dialogNode)`，`ask(request)` 返回 `Promise<string | null>`（确认→去除首尾空白的文本，取消/Esc→`null`）。特性：打开即聚焦输入框、关闭后焦点回到触发按钮、行内校验（最小/最大长度，不再用 `alert`）、单行 Enter 提交、多行 Cmd/Ctrl+Enter 提交、点击遮罩取消、`role="dialog" + aria-modal`、中英双语文案，样式在 `app/styles/features/prompt-dialog.css`。

已替换的 7 处录入点（`apps/passport-web/components/`）：

1. `certificate-admin-prototype.tsx` 签发页「撤回」原因；
2. 同文件申请审核页「拒绝 / 要求补充信息」理由；
3. 同文件自动签发规则「重命名」（预填当前名）；
4. 同文件证书记录页「撤销」原因；
5. `admin-activity-community-client.tsx` 社区审核原因（批准/拒绝/隐藏）；
6. `activity-community-client.tsx` 参与者举报原因；
7. `admin-activity-ai-content-drafts.tsx` 草稿 JSON 编辑。

保留原生 `window.confirm` 的纯确认动作（按你的决策不改）：分类启用/停用、删除空分类、删除模板、证书恢复/重新生成、AI 文案发布、机构关联移除。

顺带修掉一个可见缺陷：AI 草稿组件的 `action()` 原先只在失败时 `setError`，成功后不清除，导致上一次「JSON 格式无效」会残留显示在已成功编辑的草稿上方；现在动作开始时清空。

### 4.2 JSON 接口鉴权迁移（决策 1，第 1、2 批全部落地）

`requireAuthenticatedUser` / `requireRoleAccess` 通过 Next 的 `redirect()` 实现，对 `/api/*` 的未登录/越权请求返回 **307 → 登录页 HTML 200**，而不是 `401/403 JSON`；前端 `fetch(...).json()` 因此常报「解析失败/像登录态过期」。全仓实测 **203 个 `route.ts` 中有 102 个**使用该鉴权助手，另有 **67 个 `page.tsx` / `layout.tsx`** 使用（页面侧全部保留，未改一行）。

新增 `apps/passport-web/lib/server/api-auth.ts`，只提供 API 侧守卫，返回响应而非抛重定向：

| 守卫 | 未登录 | 角色不符 |
| --- | --- | --- |
| `requireApiUser(request)` | `401 {"error":"Authentication required."}` | — |
| `requireApiRole(roles, request)` | `401` 同上 | `403 {"error":"Forbidden."}` |
| 同上，但请求头带 `Sec-Fetch-Mode: navigate` | `307 → /<locale>/auth/login?next=<原路径>` | `307 → 该角色仪表盘` |

第二行是本轮补的**导航感知**分支：浏览器地址栏/`<a>`/`window.open` 直开一个后台导出或打印链接时，`fetch` 形态的 401 JSON 会显示成一段裸文本，体验退化。用 `Sec-Fetch-Mode: navigate` 区分「导航」与 `fetch`（后者是 `cors`），只在这两个失败分支上换回 307，不额外维护端点白名单。

调用方一律 `const u = await requireApiRole(...); if (u instanceof NextResponse) return u;`。**这一点是本次迁移的主要风险**：旧助手靠抛异常失败关闭，新助手若漏写守卫会**失败打开**（把响应对象当用户继续执行）。因此除 `tsc` 外，另跑逐调用点审计脚本（`/tmp/cp-audit-guards.mjs`）：**143 个调用点，未加守卫 0 个；`app/api/**` 中页面式助手调用点 0 个**。审计同时统计第二参数：133 个点已传 `request/req`（可走导航分支），10 个点有意不传（`admin/achievements`、`admin/badge-awards`、`admin/badge-definitions`、`admin/events`、`admin/learning-experiences/programs`、`admin/system/settings`、`admin/portfolio/rules`、`learning-experiences/applications`、`me/portfolio/consent`、`me/portfolio/share-links`）——这些是 `GET()` 无请求形参的纯 JSON 接口，只会返回 401/403。

一次自伤并被当场拦下：为把守卫并回原有单行风格而跑的批量格式化脚本，误把 3 个文件写成 `if (user) return user;`（等价于把已登录用户当失败响应返回）。`tsc` 立即报 `Property 'id' does not exist on type 'never'`，加上守卫审计，两处当场修正——这正是该迁移必须双保险的原因。

- **第 1 批**（后台写接口 + 证书/签到敏感接口）：54 个 `route.ts`、68 个调用点，覆盖 `app/api/admin/**`（含 3 个首版脚本漏掉、手工补齐的 `admin/events`、`admin/speakers` 与 `admin/portfolio/rules` 自定义 helper）、`app/api/certificates/[id]/**`、`app/api/qr/event-checkin`、`app/api/checkin`。
- **第 2 批**（用户侧分组，按端点逐个分类处理，未整组替换）：50 个 `route.ts`、75 个调用点——`activities`(18)、`me`(7)、`dashboard`(5)、`activity-participations`(4)、`learning-experiences`(3)、`activity-applications`(3)、`activity-tasks`(2)、`activity-submissions`(2)、`project-milestones` / `channel` / `activity-reward-rules` / `activity-reviews` / `activity-form-templates` / `activity-checkin`(各 1)。批量脚本额外为第 1 批的 61 个点补上 `request` 形参以启用导航分支。

同步改掉的断言（旧行为被这些用例明确钉住）：

- `tests/api/support-ticket-inbox-api.test.ts` 角色门禁：匿名 401 JSON，ATTENDEE / EVENT_MANAGER 一律 403 JSON，并断言不回传工单字段；
- `tests/api/source-activity-mapping-api.test.ts` 管理端列表：匿名 307 → 401 JSON；
- `tests/api/notification-privacy-api.test.ts`：`/api/admin/notifications/process`、`/api/admin/privacy/replay-markers` 匿名 307 → 401 JSON；
- `tests/api/controlled-assets-api.test.ts` 检疫：`[307,308,403]` 放宽断言 → 收紧为 403 JSON；
- **第 2 批新增**：`tests/api/activity-occurrences-api.test.ts` 匿名 `POST /api/activities/[id]/occurrences` 307 → 401 JSON（该文件是第 1 批刻意留下的最后一处 307 断言）；`tests/channel-bridge-routes.test.mjs` 3 个子用例改为显式桩 `@/lib/server/api-auth`（原来靠桩页面助手的 `NEXT_REDIRECT` 抛错间接表达「已登录」，迁移后不再成立）；`tests/channel-v1-contracts.test.mjs` 源码断言 `requireAuthenticatedUser` → `requireApiUser(request)`；`tests/activity-verifier-authorization.test.mjs` 改走共享 `loadRouteModule`（自带返回**实例**的 NextResponse 桩）；`tests/person-institution-master-data-phase3.test.mjs` 的 ADMIN-only 正则放宽为可带第二实参。
- 桩规则（第 1 批踩过的坑，第 2 批沿用）：`tests/_route-loader.mjs` 与私有桩的 `NextResponse.json()/redirect()` 必须返回**类实例**，否则 `instanceof` 永远为假，等于在单测里绕过了要验证的守卫。

未改的 307 断言（与本决策无关）：`tests/activity-security-boundaries.test.mjs`（旧 QR 端点 `POST` → 规范扫描端点的重定向）、`tests/certificate-issuing-rules.test.mjs`（桩 URL 形状正则）。

真实 HTTP 验证矩阵（隔离库 + 3100 端口，第 2 批落地后逐条 curl 确认）：

| 场景 | `Sec-Fetch-Mode: navigate` | 无该头（fetch） |
| --- | --- | --- |
| 匿名 `GET /api/activities`、`/api/me/portfolio/export`、`/api/admin/messages` | 307 → `/en/auth/login?next=<原路径>`（该页 200） | 401 `application/json` `{"error":"Authentication required."}` |
| ATTENDEE 越权 `GET /api/admin/messages` | 307 → `/en/dashboard/climate-passport`（该页 200） | 403 `application/json` `{"error":"Forbidden."}` |
| ADMIN `GET /api/admin/messages` | 200 JSON（不重定向） | 200 JSON |

另外全仓确认前端无任何代码读取 `response.redirected`（0 处），因此失败形态从 307 变 401/403 不会破坏既有 UI 分支。

### 4.3 决策之外的新增：Open API（API Key 控制模式）

来自你本轮追加的指令「同时要准备 Open API，采用 API Key 的控制模式」。设计说明见 `docs/OPEN_API_V1_zh.md`，机器可读规范见 `docs/openapi/v1.yaml`（仓库第一份 OpenAPI 文档）。

**控制模式**：`Authorization: Bearer <api key>`，且只认这一种。bearer 就是登记机器客户端时一次性下发的 machine key，服务端取其 sha256 摘要后经 `ChannelClient.machineKeyHash`（`@unique`）反查客户端，因此**没有引入任何数据库迁移**；scope 沿用 `CHANNEL_SCOPE_VALUES` 目录，cookie 会话在此一律不接受（接口用例专门断言「带 ADMIN 会话 cookie 但无 bearer」仍是 401）。

新增/改动：

| 文件 | 作用 |
| --- | --- |
| `apps/passport-web/lib/server/open-api-auth.ts` | 唯一的鉴权入口 `requireOpenApiKey()`：读头 → 反查 → scope → 限流，任一步失败返回可直接 `return` 的 `NextResponse`（忘掉检查的后果是「没有客户端」，不是「已授权」） |
| `app/api/v1/open/whoami/route.ts` | 密钥自省：只回调用方自己的身份、Programme、已授予 scope 与剩余配额，不需要额外 scope |
| `app/api/v1/open/certificates/[code]/route.ts` | 证书验真，需 `channel:certificates:verify`；复用与 `v1/channel` 相同的最小披露投影 |
| `packages/passport-contracts/src/index.ts` | 追加 `OpenApiErrorSchema` / `OpenApiPageMetaSchema` / `OpenApiWhoamiResponseSchema`，`API_ERROR_CODES` 增补 3 个错误码 |

与既有 `/api/v1/channel/certificates/verify/[code]` 的关键差别：那条路由**不带凭据时退回 SHCW 公开路径**，`/api/v1/open` 明确不复制这个分支——否则「鉴权失败」会变成一条能读到数据的旁路。401 响应里不会出现 `verificationCode` 或任何证书字段；而 `404 NOT_FOUND` 是「鉴权已通过」的业务结果，与 401/403 分属两类。

本轮顺带修掉一个**看起来存在、实际不可达**的安全分支：`requireOpenApiKey` 会检查 `rateLimit.unavailable` 并返回 503，但没向 `checkRateLimitAsync` 传 `sensitive: true`，因此该标志永远不会被置位——生产环境缺 `RATE_LIMIT_REST_URL` 时限流会静默退回单进程内存计数并直接放行。已按仓库既有限流约定（登录、QR 签发、verifier scan 都是 `sensitive: true`）为**认证窗口与匿名窗口**同时补上（两处实现 + 两项单测断言）。

**已知取舍（写进设计文档而非藏起来）**：bearer 形态省掉了 `clientKey`，因此**不校验 `allowedOrigins`**（双头形态才尊重它）；不提供浏览器 CORS（API Key 是服务端机密，下发到浏览器等于交给终端用户）；密钥过期/轮换/`lastUsedAt` 需要迁移，未做。


---

## 5. 回归验证结果（改动后全量重跑）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc --noEmit -p apps/passport-web` | **0 error** |
| Lint | `npm run lint` | **No ESLint warnings or errors** |
| 单元测试 | `npm test` | **576 通过 / 0 失败**（含 Open API 新增 10 条） |
| 接口集成测试 | `npm run test:api`（独立端口 + 隔离库 + test-outbox） | **163 用例：157 通过 / 0 失败 / 6 跳过**（36.2s，服务端日志 0 个 5xx；含 Open API 新增 6 条） |

6 个跳过全部是既有的数据依赖型/占位用例，不是失败：`points` 2 条 + `redemption` 3 条为「需真实兑换项/预占数据」的占位跳过；`管理员登录后可审批证书申请` 1 条因 `/api/certificate-applications` 只返回**本人**申请、而测试库中管理员账号当时没有 PENDING 申请而跳过（本轮日志逐字确认仍在跳过，原因文案「当前没有待审批的证书申请」）。此前记录的 7↔6 摆动即来自这一条——按决策 6 未重置 `climatepassport_test`，属预期噪声，与本批改动无关。

接口测试中覆盖到的关键安全链路（均通过）：机器认证负路径（无头/错 key 401、缺 scope 403）、跨 Programme 隔离一律 404、幂等与版本序（同版异内容 409 / 旧版 STALE）、权威字段编辑守卫 409、报名门 `ACTIVITY_SOURCE_NOT_PUBLISHED` 409、撤销与出站事件同事务、失败退避→死信→管理端重投、审计落库。

关于此前记录的一次偶发失败：`tests/api/activity-occurrences-api.test.ts`「多角色指派」曾在首轮出现 `POST /api/activities/[id]/people` 期望 403 实得 500，单独重跑 6/6 通过。鉴权迁移后的三轮全量重跑该用例均通过、服务端日志 0 个 5xx，判定为该路由冷编译首访的偶发问题，与本轮改动无关（本轮未触碰该路由及其依赖）。

第 1 批迁移的针对性验证：单独跑改动过的 4 个接口文件 `35 用例 / 0 失败`，日志逐条确认 `GET /api/admin/activity-mappings 401`、`POST /api/admin/assets/{id}/quarantine 403`（owner）与随后 `200`（admin）、`/api/admin/messages` 的 401/403 分支。

第 2 批迁移的针对性验证：`npm test` 从迁移中的 7 个失败修回 **566 / 0 失败**；`npm run test:api` 全量 **150 通过 / 0 失败 / 7 跳过、0 个 5xx**；守卫审计脚本输出 `143 个调用点 / 缺失或形态错误 0 / 页面式助手残留 0`；再用真实会话逐条核对 4.2 末尾的 HTTP 验证矩阵（匿名/越权/正常 × 导航/fetch 六种组合全部符合预期，重定向落地页均 200）。

Open API 的针对性验证（同一轮全量日志里逐条核对，去色后统计）：`GET /api/v1/open/whoami` 命中 **200 ×2、401 ×5**（5 个负例分别是缺头、`Basic` 形态、错误 key、只带 ADMIN 会话 cookie、撤销之后）；`GET /api/v1/open/certificates/CV-NOPE-OPENAPI-1` 命中 **404（鉴权通过后的业务未找到）/ 403（scope 不符）/ 401（匿名）** 各一次，且 401 响应体不含 `verificationCode`。单元测试额外锁定了两条容易被想当然的性质：限流窗口键必须是 `open-api:<clientId>:<scope>`（不是 IP），以及反查条件是摘要而非 bearer 原文。

第 6 节那组 curl 也已逐条真实执行（同一隔离库 + 3100）：ADMIN 登录 200 → 登记机器客户端 201（响应一次性回显 machine key）→ `whoami` 带 bearer **200**，`x-request-id` 与响应体 `requestId` 完全一致，`rateLimit` 为 `60 / 剩余 59`；不带 bearer **401 `API_KEY_MISSING`**；**只带 ADMIN 会话 cookie、不带 bearer 同样 401**（会话不能替代密钥，这条是控制模式的核心断言）；带正确 scope 查不存在的验证码 **404 `NOT_FOUND`**（鉴权通过后的业务结果）；撤销该客户端后用原 key 再调 **401 `API_KEY_INVALID`**。落库的 `openapi.access.denied` 审计行按 `metadataJson.requestId` 与上述响应一一对应，且脚本扫描确认其中既无 machine key 明文也无其 sha256 摘要。

本轮为验证弹窗在浏览器里产生的测试数据（均在 `climatepassport_test`，按决策 6 保留）：证书 `CV-X1RQUEECWWHNPBG` 撤销后已恢复为 `ISSUED`；自动签发规则 `E2E probe rule` 改名后已改回；`SUMMARY zh` AI 草稿一条，最终置为 `DELETED`；参与者 `lin.qiao@climatepass.org` 对已发布帖子提交举报一条。Open API 接口用例另留下：一个租户与 Programme、两台 MACHINE 渠道客户端（其中一台已撤销）、若干 `openapi.access.denied` 审计行。

---

## 6. 如何复现本次测试

```bash
# 1) 准备隔离测试库（不要连开发库）
npm run db:sync && npm run db:seed

# 2) 起隔离测试服务器（3100）
node scripts/run-with-test-env.mjs \
  node node_modules/next/dist/bin/next dev apps/passport-web \
  --hostname 127.0.0.1 --port 3100

# 3) 用第 1 节任一账号登录 http://127.0.0.1:3100/en/auth/login
#    密码统一为 seeded-password

# 4) 回归
npm test
npm run test:api     # 需要先停掉 3100 上的手动服务器，测试运行器要独占该端口

# 5) 只跑 Open API 相关用例
node --test tests/open-api-auth.test.mjs                                   # 10 条，不需要服务器
node scripts/run-api-tests.mjs tests/api/open-api-key-api.test.ts          # 6 条，自带隔离服务器
```

手工验证 Open API（先按第 2 步起服务器，再登记一台机器客户端拿 key）。以下顺序与结果均已真实跑过一遍，见第 5 节末尾：

```bash
# 登录拿会话 cookie（machine key 只出现在这条 201 响应里，别落进 shell 历史）
curl -s -c /tmp/jar.txt -X POST http://127.0.0.1:3100/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"locale":"en","email":"ops.admin@climatepass.org","password":"seeded-password"}'

# 登记机器客户端（programmeId 必须是 isActive 的 Programme）
curl -s -b /tmp/jar.txt -X POST http://127.0.0.1:3100/api/admin/channel-clients \
  -H 'content-type: application/json' \
  -d '{"displayName":"probe","type":"MACHINE","programmeId":"<uuid>","allowedScopes":["channel:certificates:verify"],"allowedOrigins":[]}'
# → 201 {"client":{...},"machineKey":"cpmk_...","warning":"Store the machine key now; ..."}

curl -i http://127.0.0.1:3100/api/v1/open/whoami -H "Authorization: Bearer <machineKey>"   # 期望 200 + x-request-id
curl -i http://127.0.0.1:3100/api/v1/open/whoami                                          # 期望 401 API_KEY_MISSING
curl -i -b /tmp/jar.txt http://127.0.0.1:3100/api/v1/open/whoami                          # 期望 401：会话 cookie 不是这里的凭据
curl -i "http://127.0.0.1:3100/api/v1/open/certificates/CV-NOPE-1" \
  -H "Authorization: Bearer <machineKey>"                                                 # 期望 404 status=NOT_FOUND（鉴权已通过的业务结果）
curl -i -X POST http://127.0.0.1:3100/api/admin/channel-clients/<id>/revoke \
  -b /tmp/jar.txt -H 'content-type: application/json' -d '{"reason":"probe cleanup"}'     # 撤销后原 key 再调 → 401 API_KEY_INVALID
```

注意：`npm run test:api` 会自己拉起 3100 上的服务，若你的手动服务器还占着该端口，运行器会**主动拒绝**（这是防串环境的既定行为）。

---

## 7. 交付边界声明

- 本轮所有代码改动**未提交、未推送、未部署**。
- **未执行任何数据库 migration**；3.7 的修复是纯 `seed.mjs` 代码修复（测试库中重放的是已提交 migration 自带的静态 INSERT，不涉及新 migration）。
- 未读取、未改动 dev/prod 邮件与其他生产密钥；测试邮件一律走 `test-outbox`。
- 集成测试全程只连 `climatepassport_test`。
- 3.5/3.6 的根因是先做最小复现脚本证实、再定位到代码，未凭工具或直觉下结论。
