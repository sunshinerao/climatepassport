# Climate Passport OCR 代码审计报告

日期：2026-09-20  
状态：只读审计，未运行修复  
工具：OpenCodeReview CLI（`ocr`）+ 人工源码复核

## 1. 需求解读

本次使用仓库已配置的 OpenCodeReview（`.opencodereview/config.json`）审计当前工作树，不执行自动修复、格式化、数据库迁移、测试、提交、推送或部署。

审计对象是当前 `main` 工作树，包括已修改和未跟踪实现。审计时本地分支领先 `origin/main` 13 个提交，且仍有大量未提交文件，因此结论对应当前本机工作树，不等同于远端或生产状态。

这里的 OCR 指 OpenCodeReview，不是图片文字识别。仓库中没有业务页面截图，只有 logo 图片。

## 2. 修改方法

本次仅新增本报告，没有修改应用代码。

1. 读取 OCR 主报告 `artifacts/ocr-review-worktree.{md,json}`。
2. 读取 `lib/server`、contracts、SDK 和 UI flows 的 OCR 分区报告。
3. 对 OCR 标记为 high 的权限、隐私、幂等、并发和公开读取问题进行源码复核。
4. 剔除已被当前工作树修复、与项目要求冲突或缺乏当前代码证据的评论。
5. 按发布阻断程度整理确认问题，不把 OCR 建议直接等同于事实。

OCR 主 session `d91569b6-01bc-4e91-8029-2ddf812656d8` 状态为 `partial`：选择 183 个项目，输出 126 条评论，其中 high 16、medium 46、low 64；110 个项目因配额中断未完成。CLI 不支持恢复 workspace session，执行 `ocr review --resume ...` 返回“workspace resume is not supported”。因此本报告不是完整全仓证明。

## 3. 修改内容

新增本审计文件，记录以下确认结果。

## 4. 审计结论

当前 V2.1 本地实现不能按文档所述视为安全闭环。OCR 发现中至少有 8 项发布阻断问题和 9 项高优先级一致性问题得到源码确认，主要集中在主体认领、Programme 隔离、同意/撤回、公开投影、资产扫描、通知投递和 outbox 并发。

在这些问题关闭并补真实数据库反向测试前，不应将 CP-TODO-242、244、247、248、249、251、257 或 V2.1 整体标记为可发布完成。现有 `done (local)` 可保留为历史交付记录，但发布建议必须明确存在以下缺口。

## 5. 发布阻断发现

### OCR-AUD-001：Person 自助认领可造成身份接管

严重级别：P0 / Security

任意已登录用户可向 `/api/people/[id]/claim` 提交一个尚未绑定账号的 VERIFIED Person ID。服务只验证 Person 状态和是否已绑定，不验证邮箱、邀请令牌、管理员批准或其他身份凭据。

影响：攻击者可将他人的 Person、任职及贡献历史绑定到自己的账户。

证据：

- `apps/passport-web/app/api/people/[id]/claim/route.ts:18-39`
- `apps/passport-web/lib/server/person-institution-governance.ts:107-132`

同时存在并发认领竞争：Person 更新不是 `userId = null` 条件更新，两个请求可先后通过预检。

### OCR-AUD-002：监护人同意可由调用者自行伪造

严重级别：P0 / Security

代授同意只要求 `guardianUserId === grantorUserId` 且 `evidenceJson` 非空；没有受信 GuardianLink、管理员核验或 Programme 核验回执。调用者可以为任意 subject 构造 evidenceJson。成为 grantor 后，还可读取该 subject 的全部同意历史。

影响：可伪造发布所需同意，绕过未成年人、共同作者或素材许可门槛。

证据：

- `apps/passport-web/lib/server/consents.ts:80-91`
- `apps/passport-web/lib/server/consents.ts:249-270`

### OCR-AUD-003：机构代表权未按 Programme/Edition 隔离

严重级别：P0 / Authorization

`InstitutionRepresentation.programmeId` 为必填字段，但 `resolveInstitutionRepresentation` 只按 institution、user、状态和时间窗口查询，完全忽略 programmeId/editionId；并且仅取最早一条 ACTIVE grant。

影响：Programme A 的机构代表权可被用于 Programme B；旧 READ grant 还可能遮蔽新 MANAGE grant，造成错误拒绝。

证据：

- `prisma/schema.prisma:3189-3212`
- `apps/passport-web/lib/server/person-institution-governance.ts:83-104`

### OCR-AUD-004：可向任意 Programme 创建私密记录

严重级别：P0 / Authorization

`createScopedRecord` 在提供 programmeId 时只验证 Programme 存在且启用，没有验证创建者是否拥有该 Programme 的 WRITE/MANAGE membership。创建后，该 Programme 成员可通过列表读取记录。

影响：普通登录用户可向不属于自己的 Programme 注入记录，并扩大数据可见范围。

证据：`apps/passport-web/lib/server/private-records.ts:107-157`

### OCR-AUD-005：记录撤回后历史正文仍可读取

严重级别：P0 / Privacy

`readScopedRecord` 对 WITHDRAWN 记录执行“非所有者 404”，但 `listRecordRevisions` 没有相同状态检查。已有对象授权或 Programme membership 的非所有者仍可读取全部历史 `payloadJson`。

影响：撤回不再是实际的数据访问阻断，违反 CP-FR-057/060/068。

证据：

- `apps/passport-web/lib/server/private-records.ts:166-179`
- `apps/passport-web/lib/server/private-records.ts:278-295`

### OCR-AUD-006：同意撤回后公开投影仍可匿名读取

严重级别：P0 / Privacy

发布时检查 consent，但 `PublicationProjection` 不保存 consent requirements、channel 或 programme 上下文；公开读取仅检查 `status === PUBLISHED`，不重新核验当前同意。撤回 consent 后，如果没有另一路径主动撤回 projection，内容继续公开。

此外 GET API 直接序列化完整数据库行，暴露内部 `id`、`publishedById`、`withdrawnById`、`dispatchId`，没有公开字段白名单。

证据：

- `apps/passport-web/lib/server/publication-gateway.ts:188-215`
- `apps/passport-web/lib/server/publication-gateway.ts:327-346`
- `apps/passport-web/app/api/publications/route.ts:27-35`
- `prisma/schema.prisma:3437-3453`

### OCR-AUD-007：受控资产生产扫描门实际为空

严重级别：P0 / Security

`defaultAssetScanner` 无条件返回 CLEAN，生产 finalize 路由没有注入其他 scanner。任何通过 magic-byte 与 hash 检查的文件都会被标记 READY；这不是恶意内容扫描。

影响：文档和 tracker 声称的扫描门并未在真实调用路径实现。

证据：

- `apps/passport-web/lib/server/controlled-assets.ts:48`
- `apps/passport-web/lib/server/controlled-assets.ts:296-305`
- `apps/passport-web/app/api/assets/[id]/finalize/route.ts:18`

### OCR-AUD-008：Programme Activity 人员列表公开泄露

严重级别：P0 / Privacy

`GET /api/activities/[id]/people` 无认证、无 `assertActivityScopeAccess`，返回 Person ID、角色及自由文本 note。与同资源的 institutions 路由范围策略不一致。

影响：匿名方可枚举 Programme 私有活动的人员关系及备注。

证据：`apps/passport-web/app/api/activities/[id]/people/route.ts:9-16`

## 6. 高优先级发现

### OCR-AUD-009：可靠 outbox 的租约不能区分认领者

严重级别：P1 / Concurrency

处理器先批量将候选行置 PROCESSING，再按 `id IN due AND status=PROCESSING` 读取。并发 worker 即使认领 0 行，也能读到另一 worker 刚认领的 PROCESSING 行并重复投递。

证据：`apps/passport-web/lib/server/reliable-dispatch.ts:111-136`

### OCR-AUD-010：事务内 P2002 后继续查询不可用

严重级别：P1 / Reliability

`enqueueOutboundDispatch` 捕获 create 的 P2002 后，用同一 interactive transaction 继续 `findUnique`。PostgreSQL 事务在错误后已 aborted，后续查询通常失败，预期的同键同内容幂等回读会变成 500 并回滚业务事务。

证据：`apps/passport-web/lib/server/reliable-dispatch.ts:51-82`

### OCR-AUD-011：通知并发处理可重复发送，HTML 未转义

严重级别：P1 / Reliability + Security

通知发送前没有 QUEUED→SENDING 的 CAS claim。两个 processor 可同时发送邮件，之后只有状态更新发生竞争。attempt number 也由事务外 `length + 1` 生成。

邮件 HTML 直接插入 title/actionUrl，Programme 可控文案可能形成可信发件人的 HTML 内容注入。

证据：`apps/passport-web/lib/server/notification-delivery.ts:61-68,117-141,150-180`

### OCR-AUD-012：期次容量缩减与占位存在竞态

严重级别：P1 / Concurrency

容量缩减只按 admittedCount 检查；并发 claim 只按先前读取的 admittedCount 做 CAS，没有绑定此前读取的 capacity。缩容成功后，旧 claim 仍可能把 admittedCount 增加到新 capacity 以上。

证据：`apps/passport-web/lib/server/activity-occurrences.ts:168-181,232-249`

### OCR-AUD-013：Person/Institution 合并不满足“全部引用迁移”

严重级别：P1 / Data Integrity

Person 合并遗漏 ActivityPersonRole、ContributionFact；账号从 source 转移到 target 时先设置 target，再清空 source，会触发 `Person.userId @unique`。

Institution 合并遗漏 Speaker.institutionId、ContributionFact.institutionId，且 parentInstitutionId 重写没有防止自环/祖先环。

证据：`apps/passport-web/lib/server/person-institution-governance.ts:278-309,325-360`

### OCR-AUD-014：Consent 的 Programme 范围和版本并发不可靠

严重级别：P1 / Authorization + Concurrency

- `resolveConsent` 不接收或匹配 programmeId，Programme A 的同意可用于 Programme B。
- 版本使用 findMany/max+1，模型没有同一 scope/version 唯一约束；并发授予可产生两个 ACTIVE 同版本记录。
- 先 `take: 20` 再在内存匹配 channel/object，超过 20 条时可能漏掉仍有效的通用同意。

证据：

- `apps/passport-web/lib/server/consents.ts:117-153,216-247`
- `prisma/schema.prisma:3386-3410`

### OCR-AUD-015：账户删除与恢复重放不对称

严重级别：P1 / Privacy

删除时匿名化 User 和 Person，但恢复重放 User/DELETED marker 时只匿名化 User，不处理关联 Person。账户删除也没有撤销 ConsentRecord、隔离/删除 ControlledAsset 或处理 ContributionFact，retention notice 未说明这些仍活跃的数据。

另外，独立 record/consent withdraw 流程不写 privacy marker；备份恢复后无信息可重放。未知 marker subjectType 被静默计为 skipped，而不是触发 incomplete 告警。

证据：`apps/passport-web/lib/server/privacy-lifecycle.ts:145-237,243-301`

### OCR-AUD-016：Publication 并发发布和返回契约不安全

严重级别：P1 / Concurrency + Privacy

发布前在事务外查询 existing；两个并发首次发布都可能通过，失败方在 create 的唯一冲突处返回通用 500，而非同内容 dedupe 或异内容 409。Consent 与 approval gates 同样在事务外，存在撤回与发布的 TOCTOU 窗口。

证据：`apps/passport-web/lib/server/publication-gateway.ts:158-225`

### OCR-AUD-017：受控资产 finalize 可覆盖并发检疫

严重级别：P1 / Security

finalize 读到 PENDING 后执行存储读取/扫描，再无条件 update。管理员在此窗口设置 INFECTED/QUARANTINED 后，finalize 可重新写成 READY/CLEAN。

另外允许 text/plain，但 `sniffContentType` 对任何不带已知 magic bytes 且大于等于 1024 bytes 的内容先返回 octet-stream，导致大文本永远无法通过。

证据：`apps/passport-web/lib/server/controlled-assets.ts:72-79,280-313`

## 7. 中优先级摘要

以下 OCR 项已通过源码抽查，建议在 P0/P1 后处理：

1. Activity occurrence/classification 的 `includeCancelled`、`includeWithdrawn` 查询未限制为管理者，且读取范围与 institutions route 不一致。
2. Attendance correction 的 evidenceAssetIds 只校验 UUID，不验证资产存在、READY 状态、归属或活动关系。
3. 机器证书验证成功后丢弃 ChannelClient 身份，审计只能看到 `CLIENT_API`，无法追踪具体客户端。
4. outbox reconcile 可把 PENDING/DEAD 直接置为 SUCCEEDED，且投递 receipt 与 reconcile receipt 结构不同。
5. outbox HTTP fetch 默认跟随 redirect，callbackUrl 初始校验不能阻止重定向到内网地址。
6. SDK legacy 方法直接强制转换 `response.json()`，缺少 contracts 运行时验证；server-only machine credential API 也没有浏览器运行时保护。
7. `ConfirmDangerAction` 只有外部 busy，没有内部 in-flight guard，快速双击可重复调用删除 API。
8. 记录、授权、publication、client 等列表存在固定 take 或无分页，可能静默截断或无界加载。
9. 文档中的“V2.1 shared layer fully delivered”与上述权限、撤回、扫描、恢复问题冲突，应在整改时改为“实现存在但安全验收未通过”。

## 8. OCR 评论中已排除或降级的内容

1. “组合 status=CANCELLED + 其他字段可绕过取消保护”已不符合当前源码：`updateOccurrence` 现有 admittedCount 护栏，因此不列为当前问题。
2. OCR 建议 `writeCoreAuditLog` 一律吞掉失败，与项目对关键审计“业务与审计同事务，失败整体回滚”的既定要求冲突，不采纳。应区分关键审计和明确允许 best-effort 的访问统计。
3. “所有异步循环都改 Promise.all”不是通用正确做法；有容量、顺序、外部限流或事务语义的循环不应仅为性能并行化。
4. 纯样式、重复代码、magic number 和未使用变量未进入阻断结论，原始评论仍保留在 OCR artifacts 中。

## 9. 建议整改顺序

1. 立即关闭 Person 自助认领和 guardian proxy grant，直到有可信 claim/GuardianLink 证明。
2. 修复 Programme/Edition 授权：InstitutionRepresentation、record create、consent resolve、Activity people/occurrence/classification 全部使用统一 scope 服务。
3. 让 withdrawal 在 record revisions、publication read、consent、assets、indexes 和 backup replay 上统一 fail closed。
4. 生产环境没有真实 scanner 时，asset finalize 返回不可用，不得默认 CLEAN。
5. 修复 notification/outbox 的 claim token/lease owner、幂等冲突和状态机，再做故障注入并发测试。
6. 修复 Person/Institution merge 的唯一约束顺序、全部 FK 迁移和层级防环。
7. 修复 occurrence capacity 的数据库原子条件，并补缩容与占位交叉并发测试。
8. 最后处理 SDK/UI、分页、错误码和文档状态漂移。

## 10. 验收要求

- 所有权限问题必须有隔离真实数据库正反向矩阵，不能只用源码字符串测试。
- 所有 claim、capacity、consent version、publication、notification 和 dispatch 问题必须有并发测试。
- 撤回/删除必须覆盖详情、历史、附件、公开 API、分享、导出、缓存和备份重放。
- 文件扫描必须用可控 CLEAN/INFECTED/ERROR scanner 验证；生产未配置时 fail closed。
- 修复后重新运行 OCR 全工作树审查；由于 workspace session 不能 resume，应启动新 session，并记录新 session id、覆盖数和剩余评论。
- 再运行 Node、隔离 API、E2E、lint、TypeScript、Prisma validate、build 和 migration status。生产迁移与部署仍须单独授权。

## 11. 审计限制

- OCR 主扫描因配额中断，不是完整全仓审计。
- 本轮按用户要求没有运行应用测试，也没有构造利用请求；结论来自 OCR 输出与静态源码复核。
- 未审计生产环境配置、真实数据库数据、外部扫描器、邮件供应商、真实 Channel origin/cookie/CSRF 或远端迁移状态。
- 未修改 tracker；tracker 状态应在问题修复并通过验收后再调整。
