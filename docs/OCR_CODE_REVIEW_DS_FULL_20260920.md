# Climate Passport 代码审查报告（OpenCodeReview 全量扫描 · DeepSeek）

- 日期：2026-09-20
- 工具：Alibaba OpenCodeReview CLI（`ocr` v1.12.7）+ `scan` 全文件模式
- LLM Provider：DeepSeek（`deepseek-chat`）
- 规则配置：`.opencodereview/config.json`（语言 zh-CN、排除测试/构建产物，启用 security / performance / best-practices / accessibility 规则）
- 模式：**只读审计，未做任何修复**（未改代码、未迁移、未提交、未部署）

> 说明：本报告是 `ocr` 工具自动产出的发现经人工归类整理而成，**不是逐条经源码复核的定论**。文中给出文件与行号证据供复核；标注 critical/high 者建议优先人工确认，medium/low 含较多风格与重复项。本次为独立于 `docs/OCR_CODE_AUDIT_20260920.md` 的**新扫描**（详见第 9 节对比）。

---

## 1. 扫描范围与结果概览

| 批次 | 范围 | 文件数 | 评论数 | 耗时 | 状态 |
|---|---|---|---|---|---|
| 批次 1 | `apps/passport-web/lib/server` + `packages` | 75 | 446 | 4m29s | success |
| 批次 2 | `apps/passport-web/app/api` | 201 | 953 | 6m56s | success |
| **合计** | **服务端业务逻辑 + API 路由 + 共享包** | **276** | **1399** | ~11m | **完整，无配额中断** |

严重度分布（全量 1399 条）：

| 严重度 | 数量 |
|---|---|
| critical | 15 |
| high | 361 |
| medium | 742 |
| low | 281 |

high+critical 按类别：security 187、bug 334、maintainability 16、performance 4、其他 1。
high+critical 按模块：`lib/server` 96、`app/api` 273、`packages` 7。

原始产物：
- `artifacts/ocr-ds-lib-server-packages.json`
- `artifacts/ocr-ds-app-api.json`
- 运行日志：`artifacts/ocr-ds-run-1.log`、`artifacts/ocr-ds-run-2.log`

---

## 2. 关键结论（Executive Summary）

1. **鉴权是本次最大的系统性缺陷。** 两类问题反复出现：
   - 大量公开 GET 端点缺少认证/授权，匿名者可枚举私有数据（活动人员、议程、私密记录、Summer School PII 等）。
   - `requireRoleAccess` 被当作 API 路由守卫使用，但它面向 Server Component、失败时 `redirect()` 抛错、**永不返回 `NextResponse`** —— 影响 **44 个 API 路由**。
2. **并发/幂等普遍缺失保护。** single-use token 消费、6 位验证码、批次颁发、容量占位、发布投影等多处 check-then-act 无 CAS 或唯一约束。
3. **存在多个真实可利用的高危漏洞**：`?preview=1` 证书校验旁路、PENDING 账户重激活接管、非标准 HMAC（长度扩展）、Host 头投毒导致找回密码链接被劫持、未认证时泄露他人档案。
4. **共享包（SDK/UI-flows/contracts）安全边界薄弱**：legacy 方法无运行时校验、危险确认框空串可绕过、重定向净化未覆盖百分号编码。

---

## 3. Critical 级发现（15 条，逐条）

| # | 位置 | 类别 | 摘要 |
|---|---|---|---|
| C1 | `lib/server/auth-email.ts:92` | bug | 邮箱令牌消费为 TOCTOU：`findFirst` 后再 `update` 置 `consumedAt`，并发下同一单次令牌可被重放两次。应用 `updateMany({where:{consumedAt:null}})` 原子消费。 |
| C2 | `lib/server/auth-email.ts:111` | bug | 验证码消费同样 `findFirst`+`update` 非原子，同一 code 并发提交可双双通过。 |
| C3 | `lib/server/certificate-batch-issuance.ts:74` | bug | `sourceIdForBatchItem` 假设唯一 claim，但 `CertificateIssue.sourceType/sourceId` 仅普通索引（非唯一），且调用未传 `skipDuplicateIssueId`；重叠调用可重复颁证。 |
| C4 | `lib/server/external-learning.ts:8` | security | 名为 HMAC-SHA256 实为 `sha256(secret||rawBody)` 前缀哈希，**非 HMAC**，易受长度扩展攻击：观察到一组 (body,sig) 即可伪造 `body||padding||appendData` 的合法签名。 |
| C5 | `lib/server/consents.ts:85` | security | 监护人代授同意仅凭调用方自带 `guardianUserId`+任意 `evidenceJson`，无独立 GuardianLink 校验 → 可为任意 subject 伪造同意并读取其同意历史。 |
| C6 | `app/api/activities/[id]/agenda/route.ts:22` | security | GET 无认证（POST 有），匿名者可枚举任意活动的议程（主持/讲者姓名、机构、头像）；且不校验活动存在。 |
| C7 | `app/api/activity-applications/[id]/review/route.ts:182` | bug | 传统（无 occurrenceId）分支直接 `update` 批准，绕过 `admitApplicationToOccurrence` 的座位核算 → occurrence 型活动 `admittedCount` 不增，容量约束失效。 |
| C8 | `app/api/activity-applications/route.ts:204` | bug | `requireRoleAccess` 非 API 守卫（`instanceof NextResponse` 死代码），未认证调用者得到 HTML 重定向而非 401 JSON。 |
| C9 | `app/api/activity-applications/batch-review/route.ts:76` | security | `updateMany` 作用于请求原始 `ids` 而非"已鉴权且实际取回"的集合 → 夹带未授权 id 会被一并更新。 |
| C10 | `app/api/activity-tasks/[id]/route.ts:10` | bug | 同 C8：`requireRoleAccess` 在 Route Handler 中抛 `NEXT_REDIRECT`，鉴权判定失效。 |
| C11 | `app/api/auth/register/route.ts:79` | security | PENDING 账户重激活接管：`existingUser` 查询未按邀请/开通令牌限定，任何人知晓 PENDING 用户邮箱即可用新密码注册接管该账户及关联 Summer School 申请。 |
| C12 | `app/api/certificates/verify/[code]/route.ts:11` | security | `?preview=1` 完全客户端可控并被作为 `isPreviewRequest:true` 转发，使校验在进入 code 查找前短路进 PREVIEW 分支 → 证书校验旁路。 |
| C13 | `app/api/project-milestones/route.ts:6` | security | `requireRoleAccess` 用作路由守卫无效；`"en" as any` 绕过 Locale 类型。 |
| C14 | `app/api/activities/[id]/people/route.ts:11` | security | GET 完全无鉴权，`listActivityPeople` 返回每个角色分配的 `personId`/`sourceType`/`sourceId` 及自由文本 `note` → 匿名枚举 Programme 私有活动人员关系。 |
| C15 | `app/api/external/decision-receipts/route.ts:70` | security | 跨签发方数据泄露：机器鉴权通过后，`issuerKey` 查询参数直传 `listDecisionReceipts`；仅在 truthy 时过滤 → 省略该参数即可读取**所有**签发方的回执。 |

---

## 4. High 级安全发现（人工归类的重点项）

### 4.1 未认证/授权缺失的公开端点（数据泄露）
- `lib/server/platform-data.ts:252` — **无认证用户时回退到"最早的 ACTIVE 用户"并返回其私密档案/证书数据**，直接泄露他人姓名、邮箱、电话等 PII。
- `app/api/summer-school/application-lookup/route.ts:42` — 任何未认证调用者提供匹配的邮箱或 passport ID 即返回完整 PII（申请人与监护人联系方式、`answersJson`）。
- `app/api/activities/[id]/detail/route.ts:10` — GET 无鉴权/校验，可读任意活动类型配置。
- `app/api/activities/[id]/classifications/route.ts:10` 与 `occurrences/route.ts:14` — `?includeWithdrawn=1` / `?includeCancelled=1` 对匿名调用者也生效，违背 JSDoc"仅管理者"约定。

### 4.2 越权 / IDOR / 权限提升
- `app/api/admin/institutions/[id]/representations/route.ts:38` — 被委派 MANAGE 者可将 `actionScope` 直接取自输入并**再授予 MANAGE**，权限自我扩张。
- `lib/server/private-records.ts:196` — `listScopedRecords` 按 `AccessMembership` 取 programme 记录时不校验 role 是否含 record READ，任意 membership 即可见全部 programme 记录。
- `app/api/publications/withdraw/route.ts:30` — `programmeId` 可选并默认 null，省略即可能撤回**其他 programme** 的投影。
- `app/api/records/[id]/grants/[grantId]/route.ts:18` — `revokeRecordAccess` 仅由 `grant.objectId` 定位记录，不校验与 `params.id` 一致，URL 的 record 作用域未真正生效。
- `app/api/activity-checkin/route.ts:64` — 当 `taskId` 指向调用者自身时跳过角色与 `canVerifyActivity` 校验，任何登录用户可为自己建 VALID 签到。
- `app/api/activities/[id]/applications/export/route.ts:29` — 授权早于活动类型判定，EVENT_MANAGER 可导出本应受 PROJECT 路由限制的 PROJECT 活动申请。

### 4.3 Host 头投毒 / 开放重定向 / 缓存泄露
- `app/api/auth/forgot-password/route.ts:62` 与 `app/api/activity-certificate-rules/route.ts:3` — 重定向 origin 取自 `request.url`/`new URL`（受 `Host`/`X-Forwarded-Host` 影响），可被劫持到攻击者域名（找回密码链接定向）。
- `app/api/qr/identity/route.ts:39` — 返回原始 bearer 令牌 QR 却无 `Cache-Control: no-store`，代理/浏览器缓存后可被重放。
- `app/api/public/portfolio/[token]/route.ts:0` — 仅设 `X-Robots-Tag`，缺 `no-store`/`private`/`Vary`，CDN 可按 URL 命中把 A 用户内容返回给 B 请求。
- `app/api/me/portfolio/share-links/route.ts:19` — 创建分享链接时**不校验** `portfolioShareConsent`（读取侧才校验），可在未同意下生成公开链接。

### 4.4 校验绕过 / 敏感信息外泄
- `app/api/activity-reviews/route.ts:54` — PATCH body 字段直接展开进 `update`，可写入任意 `status`（绕过工作流状态机）与任意类型/范围 `score`。
- `app/api/admin/external-learning/providers/route.ts:0` — GET 列表泄露 `signingSecretRef`、`verificationConfigJson` 等签名相关配置。
- `app/api/v1/channel/certificates/verify/[code]/route.ts:20` — **fail-open**：`prisma` 不可用时把已呈现机器凭据的请求强制降级为未认证 SHCW 分支。
- `app/api/admin/special-passes/[id]/qr/revoke/route.ts:48` — 原样回传 `error.message`，泄露内部实现/存在性信息。
- `app/api/certificates/verify/[code]/route.ts:8` — 限流未加 `sensitive:true`，生产限流器不可达时退化为进程内桶。
- `app/api/admin/summer-school/applications/route.ts:28` — 过度取数（`answersJson`/`guardianPhone`/`projectSlug` 客户端未消费）。

### 4.5 共享包（packages）安全边界
- `packages/passport-ui-flows/src/index.tsx:58` — 危险操作确认框：`confirmValue` 为空串时两侧 trim 后相等，`ready` 直接置 `true` → 绕过"输入确认词"保护。
- `packages/passport-core/src/channel-bridge.ts:13` — 重定向净化只拦裸反斜杠，**未拦百分号编码分隔符**（`%2F`/`%5C`），与同族 `sanitizeLocalRedirectPath` 不一致。
- `packages/passport-core/src/channel-config.ts:19` — `prefixesMalformed` 仅报布尔，类型正确但不受支持的取值未真正 fail-closed。
- `packages/passport-sdk/src/index.ts:86,101` — legacy `issueBridgeToken`/`exchangeBridgeToken` 用 `as` 强转、无 zod 运行时校验，`redirectTo` 未净化即用于跳转（开放重定向风险）。

---

## 5. 系统性问题：`requireRoleAccess` 被误用作 API 守卫

`lib/server/auth.ts` 的 `requireRoleAccess` 面向 Server Component/页面：失败时通过 `redirect()` 抛 `NEXT_REDIRECT`，**从不返回 `NextResponse`**。在 Route Handler 中据此判定 `if (auth instanceof NextResponse) return auth` 是**死代码**，导致：
- 未认证/越权调用者收到 HTML 重定向而非 401/403 JSON；
- 部分路由实际未生效鉴权。

本次扫描在 **44 个 `app/api` 路由**（non-low）中命中该模式（含 `admin/*`、`project-milestones`、`activity-participations/[id]` 等）。建议统一改用返回 JSON 的 API 鉴权辅助函数（如提供 `requireApiRole(...)`），此为**整改方向**、本次未实施。

---

## 6. Medium 级汇总（742 条，主题化）

数量大且含重复，按主题归并（供后续筛查）：
- **输入校验（security 139 条含此）**：`status`/`recordType`/`programmeId`/路径 `id` 等未做枚举或 UUID 校验即进 Prisma 过滤器；非法值多退化为 500 或空集而非 400。
- **分页/无界加载**：多处列表 `findMany` 无 `take`/`cursor`（channel-clients、activity-people、records、publications 等），或硬编码 `take:100/20` 静默截断。
- **并发/幂等**：徽章授予、同意版本、发布投影、outbox 租约等 read-then-create 缺唯一约束或 CAS。
- **审计持久性不一致**：部分安全相关审计用 `.catch(()=>undefined)` 静默吞失败，与"关键审计应与业务同事务"的要求相冲突（须区分关键审计 vs 允许 best-effort 的统计）。
- **错误码复用/语义误导**：`Person not found`、`Role assignment not found` 复用 `PARTICIPATION_NOT_FOUND`；`RECEIPT_ISSUER_UNVERIFIED` 等。
- **通知/投递**：邮件 HTML 未转义（title/actionUrl 拼接），发送前无 QUEUED→SENDING claim，`redirect` 默认可被 SSRF。
- **迁移脚本幂等性混用**：`IF NOT EXISTS` 与裸 `ADD CONSTRAINT`/`CREATE INDEX` 混用，部分失败后不可重跑。

## 7. Low 级汇总（281 条）

以 maintainability（184）、security（32）、bug（42）为主：重复代码（merge 路由近重复、用户匿名化块重复）、嵌套三元违反项目规范、`==`/`!=` 松散比较、`as any`、未使用变量/参数（`req`、`user`、`CONSENT_STATUSES` 死代码）、测试替身未模拟 `orderBy`/`take`/唯一约束、通知 actionUrl 硬编码 `/en/...` 等。

---

## 8. 建议整改优先级（非本次实施）

1. **立即**：修复 4.1 / C11 / C12 / C15 等真实可利用的鉴权与越权（证书预览旁路、注册接管、跨 issuer 泄露、未认证 PII 泄露）。
2. **高**：统一 `requireRoleAccess` → API 侧 JSON 鉴权守卫（覆盖第 5 节 44 路由）；C4 改用标准 HMAC；C1/C2 令牌原子消费。
3. **高**：Programme/Edition 授权闭环（records、consents、representations、publications withdraw）；IDOR/类型判定顺序。
4. **中**：Host 头来源改用可信配置、敏感响应补 `Cache-Control: no-store`、packages 运行时校验与重定向净化。
5. **中/低**：分页与输入校验、错误码、审计持久性策略统一、迁移幂等、测试替身补唯一约束与排序。

---

## 9. 与既有审计（`docs/OCR_CODE_AUDIT_20260920.md`）的关系

| 维度 | 既有审计 | 本报告 |
|---|---|---|
| LLM | kimi-for-coding（partial） | DeepSeek（完整） |
| 覆盖 | 工作树 183 选 126 条，**110 文件因配额中断** | 276 文件 / 1399 条，**无中断** |
| API 路由 | 未完整审查 `app/api` | **新增 201 个路由全覆盖** |
| 定位 | 含人工源码复核结论（8 项 P0 + 9 项 P1） | OCR 归类整理，**供复核**，未逐条定论 |

- 与既有 P0 **相互印证**：Person/guardian 代授（C5）、公开人员列表（C14）、consent 范围等一致。
- **本报告新增、既有文档未记录**的高危项：
  - `auth-email` 令牌/验证码 TOCTOU（C1/C2）、
  - `external-learning` 非标准 HMAC 长度扩展（C4）、
  - `?preview=1` 证书校验旁路（C12）、
  - 注册 PENDING 账户接管（C11）、
  - `batch-review` updateMany 越权集（C9）、
  - `platform-data` 未认证回退泄露、Summer School lookup 泄露、
  - Host 头找回密码劫持、QR/portfolio 缓存泄露、
  - UI-flows 空串绕过确认框、channel-bridge 百分号编码绕过。

---

## 10. 审计限制与免责声明

- 本报告为 **`ocr` 工具自动输出的人工归类整理**，多数条目附文件:行号证据，但**未逐条构造利用请求或跑真实数据库验证**；critical/high 建议人工复核后再定级。
- DeepSeek 输出量大（1399 条），含风格类与重复项；本报告的"模式命中数"为关键词粗聚合，**不作精确统计**。
- 未审计：前端组件/页面（`app/[locale]`、`components/`）、生产环境配置、真实数据、外部扫描器/邮件供应商、数据库迁移执行状态。
- 按用户要求：**本轮未做任何修复**。整改须另行授权，并补真实数据库正反向权限矩阵与并发测试后，重新扫描比对。

---

## 11. 复核判定与本次修复结果（2026-09-20 追加）

> 应要求进入"确认→按严重度修复"阶段。修复前对 15 条 critical 与高危 security 逐条读源码复核，**OCR 严重度存在系统性高估**：4 条为假阳性/已缓解/误判，2 条需产品/架构决策不能臆造，其余真实且自包含者已修复。

### 11.1 逐条复核判定

| 编号 | 判定 | 依据 |
|---|---|---|
| C1/C2 auth-email 令牌/验证码 TOCTOU | **属实→已修复** | `findFirst`/`findUnique` 后非原子 `update` |
| C3 批次重复颁发 | **假阳性（已缓解）** | `claimBatchItems` 对每条 item 带 lease 逐条 CAS（`count===1`）+ 处理前回读 `existingIssue`，同 item 不被并发双处理 |
| C4 external-learning HMAC | **属实→已修复** | 代码 `sha256(secret‖body)` 与其自身声明的 `algorithm==="HMAC-SHA256"`（webhook 路由第 17 行）矛盾；生产 secret 解析返回 null（未上线），改标准 HMAC 兼容现有源码级测试 |
| C5 监护人代授伪造 | **属实→暂缓（需决策）** | 正确修复需引入可核验 GuardianLink 子系统；`consents.test.mjs`/`consents-api.test.ts` 断言当前行为为设计特性，文档注明"真实未成年人启用仍需获批政策" |
| C6 agenda GET 无鉴权 | **存疑→暂缓（需决策）** | 活动议程/讲者可能属有意公开；擅自加门禁可能破坏公开活动页 |
| C7 legacy 审批不占座位 | **属实→暂缓（需确认）** | 仅当 occurrence 型活动走 legacy 分支才成立，需确认产品路由 |
| C8/C10/C13 requireRoleAccess | **误判（降级）** | `redirect()` 抛 `NEXT_REDIRECT` → fail-closed，非鉴权绕过；真实问题是 API 返回 HTML 重定向而非 401 JSON，属**响应契约错误**，且 `instanceof NextResponse` 为死代码 |
| C9 batch-review updateMany | **加固（非可利用）** | 授权循环已对每条存在的申请 403；收窄到已授权 id 属防御性加固 |
| C11 注册 PENDING 接管 | **属实→暂缓（需决策）** | 修复需邀请/开通令牌模型，属产品级流程，不能臆造校验来源 |
| C12 `?preview=1` 旁路 | **假阳性** | PREVIEW 分支仅返回固定 `result:"PREVIEW", valid:false` 样板消息，不含任何真实证书/用户数据；真实校验仅在 `isPreview=false` 执行 |
| C14 people GET 公开 | **属实→暂缓（需决策）** | 代码注明"公开读取"为设计意图，与 institutions 路由范围策略不一致；收紧属产品决策 |
| C15 回执 GET 跨 issuer | **属实→已修复** | `listDecisionReceipts` 仅在 `issuerKey` truthy 时过滤，省略即读全部；已绑定为认证客户端 key |
| platform-data 未认证回退 | **属实→已修复** | `getPassportPageData`、`getProfileMaintenancePageData` 未登录时查 `{status:"ACTIVE"}` 返回最早用户 PII；两函数均已内建 `!user` 访客空态分支 |

### 11.2 本次已修复（真实、自包含、行为安全）

1. `lib/server/auth-email.ts` — `consumeEmailTokenByToken` / `consumeEmailTokenByCode` 改**原子条件认领**（`updateMany` where `consumedAt:null, expiresAt>now`，`count!==1` 视为已消费返回 null）。
2. `lib/server/external-learning.ts` — `verifyExternalLearningSignature` 改**标准 HMAC-SHA256**（`createHmac("sha256", secret).update(rawBody)`），与声明契约一致。
3. `app/api/external/decision-receipts/route.ts` — GET 的 `issuerKey` **绑定为认证客户端 `auth.issuerKey`**，不再信任客户端参数。
4. `app/api/activity-applications/batch-review/route.ts` — `updateMany` 与审计 **收窄到已授权 `applications` id 集合**。
5. `lib/server/platform-data.ts` — `getPassportPageData` 与 `getProfileMaintenancePageData` 未登录时 **不再回退到他人用户**（`where:{ id: currentUser?.id ?? "" }` → 命中既有访客空态分支）。

### 11.3 验证结果

- 单元套件 `node --test tests/*.test.mjs`：**558 通过 / 0 失败**。
- 定向：auth 路由 + external-learning HMAC 源码测试 **47 通过**。
- `tsc --noEmit`（passport-web）：**无类型错误**。
- 6 个改动文件 `next lint`：**无告警/错误**。
- 集成 API 测试（`tests/api/*.test.ts`）需运行中的 app + 隔离测试库；本轮未启动服务，判定为环境未就绪而非逻辑回归（decision-receipts GET 测试仅用同一提交客户端回读自身回执，与绑定 `auth.issuerKey` 等价）。

### 11.4 暂缓项（需你决策后再修）

| 项 | 需要的决策 |
|---|---|
| C5 监护人代授 | 是否现在引入 GuardianLink 可核验关系；或先 fail-closed 关闭代授（会改动既有同意流程与测试） |
| C11 注册 PENDING 接管 | PENDING 账户的来源与应校验的邀请/开通令牌契约 |
| C6 agenda / C14 people | 这些读取是否**有意公开**；若否则统一接入 `assertActivityScopeAccess` |
| C7 legacy 审批占座 | occurrence 型活动是否允许走 legacy 审批路径 |
| requireRoleAccess（系统性） | 是否新增返回 JSON 的 `requireApiRole` 并统一改造 44 个 API 路由（范围较大） |

### 11.5 第二轮复核：追加的两条"优先修复项"均不成立（2026-09-20 追加）

据反馈追加了两条待修项，逐条对照仓库源码后**均无法复现**，故未改动任何代码：

| 追加项 | 判定 | 依据 |
|---|---|---|
| "C1/C2 未修复：SHA256 邮箱令牌查询 + 无条件 `updateMany`，返回首个 ACTIVE 用户" | **不成立（描述的对象不存在）** | ①全仓库不存在 `emailTokenHash` 列与 `resolveUserByVerifiedEmail` 函数（`grep` 零命中）；实际列为 `tokenHash String @unique`（`prisma/schema.prisma:825`）。②`consumeEmailTokenByToken` 用 `findUnique({ where: { tokenHash } })`，查询**已按提交的 token 限定**；`consumeEmailTokenByCode` 的 `where` 同时含 `purpose + email + code + consumedAt:null + expiresAt>now`，同样已限定。③两处 CAS 均作用于上一步校验通过的同一 `record.id`，返回值即被占用行，**不存在"用自己的合法凭据返回他人记录"的路径**。④"返回首个 ACTIVE 用户"是 `platform-data.ts` 的旧模式，已在 11.2 第 5 项修掉。 |
| "P1-3 六处页面未创建会话 Cookie" | **不成立（六个文件路径均不存在）** | `app/[locale]/dashboard/verifier/`、`app/[locale]/dashboard/programme-admin/` 与任何 `tracks/**/page.tsx` 在本仓库中不存在；审计日志页实际位于 `app/[locale]/admin/certificates/audit-logs/page.tsx`。 |

两条的共性：所指文件/符号在本仓库**零命中**（含 docs 与 OCR 原始 artifacts），并非本项目代码，疑为陈旧快照或跨项目串档。**结论：不据此改动，也不新建 programme-admin/tracks 这套不存在的功能面。**

#### 11.5.1 复核过程中确认的真实相邻缺陷（尚未修，属 §11.4 同一决策域）

- `app/api/auth/verify-email/confirm/route.ts:68-80`：token 分支不要求提交 `email`（第 64 行的邮箱一致性校验只在 `email` 存在时执行），且无条件 `status:"ACTIVE"` + `createUserSession`。即持有任一未过期 VERIFY_EMAIL token 即可激活该账户并取得会话——被管理员停用的账户可被自助复活。与 C11 同属注册/开通令牌契约，**不能靠加 `status==="ACTIVE"` 过滤来修**（注册时用户本就处于 PENDING，会导致正常验证失败）。
- `prisma/schema.prisma:829` 的 `AuthEmailToken.attempts` 字段**从未被使用**：6 位数字验证码无尝试计数，仅依赖路由级 IP 限流（`auth-verify-confirm`，10 次/10 分钟），存在在线爆破面。

