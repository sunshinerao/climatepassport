# Climate Passport Open API v1 设计说明（控制模式：API Key）

> 状态：**草案，未上线**（生产入口未部署，当前只有隔离测试环境）。
> 机器可读规范见 `docs/openapi/v1.yaml`（10 条路径 / 21 个操作，与 `app/api/v1/open/**` 的
> 真实路由一一对应，由 `node artifacts/check-openapi.mjs` 校验）。
> 本文记录工作区里**已经落地并能跑测试**的代码；文末「仍未做的事」里的内容**没有实现**。
> 本轮改动全部未提交，等你审。

---

## 1. 范围：对外机读能力只有这一个前缀

`/api/v1/open` 是**对外承诺的稳定契约**：单一凭据形态、单一错误信封、每次调用可归因、
可配额、可撤销。**原先散在 `/api/external/**` 的 8 个机器端点已整体并入并删除，不留别名**
（2026-09-21 决议第 5 条：「直接删除，只留 /api/v1/open」）。

并入不是改个路径前缀。旧端点跑在内部双头通道上，调用方是自己人，跨 Programme 靠 `clientKey`
天然隔开；对外之后这个前提不成立——同一把 key 的能力必须按 Programme 划定范围，见 §7。
另外补齐了三件旧端点都没有的事：`x-request-id` 贯穿所有响应、统一的 `{error:{code,message,requestId}}`
信封、列表端点的游标分页（`OpenApiPageMetaSchema`）。

**它不复制「退回公开行为」这条分支**：那等于给鉴权失败留一个能读到数据（哪怕是公开数据）的旁路，
也让同一个 URL 的响应结构取决于调用方有没有凭据。

## 2. 控制模式：API Key，且只有 API Key

```
Authorization: Bearer <clientKey>.<machineKey>
```

- `clientKey` 是登记时下发的客户端标识（`ChannelKeySchema`：`^[A-Z0-9][A-Z0-9_-]{0,62}$`）；
  `machineKey` 是形如 `cpmk_…` 的机密，16–72 字符。整个 bearer ≤ 136 字符。
- **为什么凭据要带 `clientKey`**：库里存的是**带随机盐的 bcrypt**（`machineKeyBcrypt`），
  盐随机 ⇒ 同一明文每次摘要不同 ⇒ 根本不存在「按摘要反查行」的索引路径。所以凭据必须自带
  定位信息：先按 `key` 查行，再对该行的 bcrypt 串做 `compare`。
  （`ChannelClient.machineKeyHash` 那个 `@unique` 无盐 sha256 列只保留到该 key 轮换为止，
  轮换后清空；`whoami` 与列表用 `algorithm: "sha256-legacy"` 把这类存量行标出来。）
- 只有 `Authorization` 头这一种形态。不接受查询串携带（会落进访问日志与浏览器历史），
  不接受 `Basic`，不接受 cookie 会话。
- 客户端必须同时满足：行存在 **且** `isActive` **且** `type === "MACHINE"` **且** 其
  `programme.isActive`，且密钥本身过 bcrypt 校验。任一不满足 → `401 API_KEY_INVALID`，
  **不区分**「key 不存在」与「key 已撤销」，避免把接口变成 key 枚举 oracle。
- scope 从 `CHANNEL_SCOPE_VALUES` 目录里取（`packages/passport-contracts/src/index.ts`），
  登记时校验、调用时比对；不匹配 → `403 API_KEY_SCOPE_DENIED`。

`/api/v1/open/whoami` 不要求 scope，只回调用方自己的身份、白名单、生效配额与密钥生命周期——
排查「这把 key 到底能做什么、还剩多少、什么时候过期」的第一站。它绝不返回别的客户端，
也不返回任何摘要/密文字段。

### 与 `x-channel-client-key` + `x-channel-machine-key` 双头的关系

同一把密钥、同一套策略的两种传输形态，认证的是同一个 `ChannelClient` 行：双头给面向浏览器的
渠道 bridge 流程用；bearer 给对外 Open API 用。判定逻辑（过期、scope、Origin、IP）住在
`channel-client-auth.ts` 的 `evaluateSourceConstraint` / `parseOpenApiKey` / `verifyChannelMachineSecret`
里，两边共用，**不存在「Open API 少校验一层」的旁路**。错误码按通道命名区分：
双头是 `CHANNEL_*`，bearer 是 `API_KEY_*`。

## 3. 密钥生命周期（2026-09-21 决议第 1、2 条）

`ChannelClient` 已有的策略列：

| 列 | 用途 |
| --- | --- |
| `machineKeyBcrypt` | 带盐 bcrypt 存储（新登记一律写这里） |
| `machineKeyHash` | 存量无盐 sha256，**只读到轮换为止** |
| `machineKeyIssuedAt` / `machineKeyRotatedAt` | 下发与轮换时间 |
| `machineKeyExpiresAt` | 过期时间；`expiresInDays` 上限 730 天 |
| `machineKeyLastUsedAt` | 每次成功认证刷新，用于「还有人在用吗」的收口判断 |
| `revokedAt` / `revokeReason` | 撤销时刻与原因（审计可追责） |
| `allowedOrigins` / `allowedIps` | 来源白名单，见 §4 |
| `rateLimitLimit` / `rateLimitWindowMs` | 每把 key 的配额，见 §5 |

管理面（ADMIN 会话，`requireApiRole(["ADMIN"])`）：

- `POST /api/admin/channel-clients` 登记，响应一次性回显 `machineKey` 与拼好的
  `openApiKey`（`<clientKey>.<machineKey>`），并带 `warning` 提示「此后不再返回」。
- `POST /api/admin/channel-clients/[id]/rotate-key` 轮换：可选 `expiresInDays`、`reason`；
  旧 key **立即失效**，`machineKeyHash` 清空（legacy 行就此收口），写 `machineKeyRotatedAt`
  与新的 `machineKeyExpiresAt`，审计留痕。
- `POST /api/admin/channel-clients/[id]/revoke` 撤销并记原因；此后该 key 一律 `401`。
- `GET /api/admin/channel-clients` 列表：绝不返回摘要列，只给
  `machineKeyConfigured` / `machineKeyAlgorithm` 这类可判读元数据。分页与筛选都在服务端：
  `programmeId` / `type` / `search`（展示名与 client key，大小写不敏感）+ `page` / `pageSize`
  （默认 25、上限 100；`page`/`pageSize` 非法值 400，页码越界则是空清单 + 真实 total，不是 404），
  响应带 `pagination { page, pageSize, total, totalPages }`。
  排序是 `createdAt desc, id asc`——次级键不是冗余：同一毫秒批量登记的行只有靠它才不跨页重复或漏行。

**过期与撤销的分工是刻意的**：撤销/停用 = `401`（身份不再成立）；过期 = `403 API_KEY_EXPIRED`
（身份成立但策略拒绝，调用方需要的是轮换而不是换一把 key）。`PATCH [id]` 改配额或白名单
不需要重发密钥。

管理台入口是 `/[locale]/admin/channel-clients`（ADMIN-only，`components/admin-channel-clients-manager.tsx`）。
它**不新增任何服务端能力**，只是把上面四个路由接到表单上，因此密钥的安全性质与直接调 API 完全一致：
明文只在登记/轮换响应里出现一次（页面上是只读 + 聚焦即全选的回显框），列表永远拿不到摘要列——
「摘掉密钥列」的投影只有 `GET` 路由一处，页面不重复查库，就少一个会漏密钥的地方。
轮换与撤销都强制走应用内弹窗收集原因，不使用 `window.prompt`。

## 4. 来源约束：Origin 强校验 + IP 白名单（决议第 3 条）

`evaluateSourceConstraint({origin, clientIp, allowedOrigins, allowedIps})`：

1. **出现 `Origin` 就按浏览器请求处理**：必须命中该 key 的 `allowedOrigins`（规范化掉尾部 `/`）。
   空白名单**不再等于放行** → `403 API_KEY_ORIGIN_DENIED`。把 API Key 带进浏览器本身就该是
   显式登记的例外。
2. **没有 `Origin` 的是服务端到服务端**：`allowedIps` 非空时按 IP/CIDR 校验；白名单非空却
   **无从归因来源地址**时同样 fail-closed → `403 API_KEY_IP_DENIED`，不退回「查不到就放行」。
   `allowedIps` 为空表示不加这层约束（把关的仍是密钥 + scope）。
3. 带 Origin 的调用只按 `allowedOrigins` 判定，不叠加 IP。

来源地址解析与限流分桶共用同一判定：只有 `RATE_LIMIT_TRUST_PROXY=true`（可信反代之后）才采信
`x-forwarded-for`，否则只看 `x-real-ip`。这避免了「限流按 A 分桶、IP 白名单按 B 判定」的不一致。

### 浏览器 CORS 是这条规则的配套，不是放松

有了「Origin 必须命中白名单」却没有回 CORS 头，等于把合法浏览器调用挡在预检阶段——
那才是真正的不支持前端直连。现在：

- 命中白名单且**凭据校验通过**的响应才回显 `access-control-allow-origin: <origin>` + `vary: Origin`
  + `access-control-allow-credentials: false`。凭据只走 `Authorization`，绝不带 cookie
  （带 cookie 会让 Open API 变成会话旁路）。`corsOrigin` 只在 `auth.ok` 之后才被赋值。
- 服务端调用没有 Origin ⇒ 响应里没有任何跨源头。
- 预检（`OPTIONS`，各路由 `export const OPTIONS = openApiOptions`）没有凭据，判定改为
  「是否存在**启用中的**机器客户端允许这个 origin」，**绝不回 `*`**（回 `*` 等于替所有租户声明可达）。
  不在白名单 → 403 且不透露该来源是否在别的 key 上登记过；不带 Origin → 405；库不可用 → 503。
- 已知不一致（无功能影响）：预检声明放行 `idempotency-key` 头，但服务端**不读取**它——
  幂等一律靠请求体字段 `idempotencyKey`。契约里已标注为预留。

## 5. 配额：每把 key 可配（决议第 4 条）

优先级：**该 key 的登记值** > 端点默认 > 全局默认 `60 次 / 60 秒`。
理由：管理台与合作方约定的额度是**契约**，端点不能在代码里把它悄悄压低或抬高。

```ts
checkRateLimitAsync(`open-api:${clientId}:${scope ?? "introspect"}`, { limit, windowMs, sensitive: true })
```

- 按「key × scope」分窗口：只按 IP 计数时，同一 NAT 出口的多个合作方会互相挤占配额；
  按 key 计数才是可对账、可承诺、可单独提额或封禁的单位。
- **未认证尝试**（缺头、错 key）按来源地址计数，`20 次 / 60 秒`，键
  `open-api:unauthenticated:<ip|source-unattributed>`。这一窗口同时约束了攻击者每窗口能强制
  多少次 bcrypt 校验。
- 两类窗口都以 `sensitive` 向 `checkRateLimitAsync` 申请。不传这个标志时，生产环境缺分布式后端
  （`RATE_LIMIT_REST_URL`）会静默退回单进程内存计数并直接放行——`unavailable → 503` 这条分支
  根本不可达，等于把「密钥配额」变成一个看起来存在、实际会消失的控制。
- 计数键刻意**不含配额**：`PATCH` 提额后同一窗口里的既有计数还在，不会因为换键而清零。

## 6. 授权层与错误信封

`requireOpenApiKey(request, { scope, rateLimit })`（`lib/server/open-api-auth.ts`）是唯一入口，
按 §2 的顺序做完 数据库 → 凭据形态 → 客户端与密钥 → 过期 → scope → 来源 → 配额，
任一步失败都返回一个可直接 `return` 的 `NextResponse`：

```ts
const gate = await requireOpenApiKey(request, { scope: "channel:activities:source" });
if (!gate.ok) return gate.response;
```

调用点因此只有两种写法，忘掉的后果是「没有客户端」，永远不会是「请求已授权」。

信封固定 `{ error: { code, message, requestId, retryAfter? } }`（`OpenApiErrorSchema`，`.strict()`）。
错误码只增不减；未登记的码从 `openApiDomainError` 吐出来时会退化成 `INTERNAL_ERROR` / 500 并打日志
——对外宁可少说原因，也不能给出一个契约里没有、调用方无法枚举的码。
请求体过不了契约校验 → `400 INVALID_REQUEST`，文案取第一条 issue。

注意仓库里**两套信封并存**：Open API 是嵌套 `{error:{code,message,requestId}}`；
内部/管理/用户侧接口是扁平 `{error:"msg", code:"..."}`。写接口用例时别混用（本轮踩过一次）。

## 7. 多 Programme 隔离（这是对外能力，不是 CP 内部端点）

原则一句话：**可见与可写的范围只由 key 自己的 `programmeId` 决定，任何另传的
`system` / `programmeId` / `issuer` 都不采信**。跨 Programme 探测**一律 404，绝不 403**——
403 等于确认「那个 id 存在，只是在别人名下」。

对象与 Programme 之间的边各不相同，隔离只能顺着实际的边走：

| 对象 | 与 Programme 的边 | 对外规则 |
| --- | --- | --- |
| `activity` | 只有 `SourceObjectMapping`（`applyStatus = ACTIVE`） | 写入前必须证明活动已接入本 Programme；未接入按不属于任何一方处理 |
| `institution` | 只有 `InstitutionRepresentation(status = ACTIVE)` | 无本 Programme 代表授权 → 404 |
| `record`（`ScopedRecord`） | `programmeId` 可空 | 必须等于本 Programme；`programmeId` 为 null 的个人记录对外**不可达** |
| `person` | 无边（全局身份） | 不按租户切分，只给公开白名单投影 |
| 决定回执 | 提交时落 key 自己的 `programmeId` | 回读按认证的 `issuerKey` 划界 |

落点：

- `lib/server/open-api-scope.ts`：`assertOpenApiActivityInProgramme`（分类登记/撤回）、
  `assertOpenApiActivityBindable`（**绑定即归属**：未接入的活动可被本 Programme 绑定，
  已被别的 Programme 接入的不可抢占）。
- `lib/server/source-ref-contracts.ts`：`programmeId` 直接取认证出来的那一行；
  四类对象按上表分别要求投影可达，否则 404 `SOURCE_REF_NOT_FOUND`。
- `/api/v1/open/source-refs/resolve` 的请求体**没有 `system` 字段**（`.strict()`）：
  来源系统就是调用方自己的 `clientKey`，允许替别人填 system 等于允许替别人解析。
- 活动修订/发布/取消三个端点**不需要**额外的 Programme 断言：映射行按
  `sourceSystem = 调用方自己的 key` 定位，一把 key 只能动自己接入的对象，跨租户无从寻址。
- 回执列表的 `minimalJson` 与 `signature` 不外发：提交方本来就有自己的副本，
  公开它们只会扩大泄漏面；对外给的是 `contentHash` 这类可对账字段。

## 8. 审计归因

控制面拒绝都是 `action = "openapi.access.denied"`；业务写入按各自动作落
（`source_mapping.bind/apply/publish/cancel`、`publication.published/withdrawn`、
`activity.cancelled`、`decision_receipt.receive`、`source_ref.resolve`、
`activity_classification.set/withdraw`）。

`CoreAuditLog.actorUserId` 是指向 `User` 的外键，把客户端 id 塞进去会直接违反外键，
所以客户端只能落在 subject 侧。归因刻意不对称：

| 情形 | `subjectType` | `subjectId` | 原因 |
| --- | --- | --- | --- |
| key 未知 / 已撤销 / 形态不对 | `OpenApi` | `null` | 还不能指名是哪个客户端，伪造归因比留空更糟 |
| key 有效但 scope / 来源 / 过期被拒 | `ChannelClient` | 客户端 id | 已解析出身份，拒绝必须可追责 |
| 超出配额 | `ChannelClient` | 客户端 id（`metadataJson.clientKey` 附可读标识） | 同上 |

`metadataJson` 只放 `{ requestId, requiredScope, clientKey, ... }`——`requestId` 与响应头
`x-request-id` 一一对应，外部工单报一个 id 就能定位到那一行。**审计行与响应体都不出现
bearer 原文或其摘要**，由测试锁定。

## 9. 端点清单（10 条，与 `docs/openapi/v1.yaml` 一致）

| 方法 | 路径 | scope | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/open/whoami` | — | 身份、白名单、生效配额、密钥生命周期 |
| GET | `/api/v1/open/certificates/{code}` | `channel:certificates:verify` | 证书验真（最小披露投影） |
| POST | `/api/v1/open/source-refs/resolve` | `channel:source:resolve` | sourceRef → `schemaRef` + 白名单投影 + `contentHash` |
| POST | `/api/v1/open/activity-mappings` | `channel:activities:source` | 绑定来源对象与活动（幂等） |
| POST | `/api/v1/open/activity-mappings/revisions` | `channel:activities:source` | 按版本序应用白名单字段修订 |
| POST | `/api/v1/open/activity-mappings/publish` | `channel:activities:source` | 发布投影版本（不可变，撤回版本禁止复活） |
| POST | `/api/v1/open/activity-mappings/cancel` | `channel:activities:source` | 关闭入口并撤回全部已发布版本 |
| POST | `/api/v1/open/activity-taxonomy` | `channel:activities:source` | 登记外部分类引用（201 新建 / 200 去重） |
| POST | `/api/v1/open/activity-taxonomy/withdraw` | `channel:activities:source` | 撤回分类引用（更高版本可重新登记） |
| POST/GET | `/api/v1/open/decision-receipts` | `channel:decisions:submit` | 提交回执 / 游标分页回读本 key 的回执 |

每条路径都支持 `OPTIONS` 预检。列表分页统一 `limit`（默认 50，上限 200，非法值 400 而不是
悄悄回默认）+ 不透明 `cursor`，用 keyset（`receivedAt + id`）而不是 offset：对外数据是持续
增长的时序，offset 在翻页途中插入新行会让调用方重复或漏读。

证书验真走 `resolvePublicCertificateVerification(...)`（与面向浏览器的渠道端点同一个最小披露
投影）：只回标题、持证人姓名、打码 Passport ID、签发机构、签发/到期日期、凭证类型、
证书编号、核验时间；`accessLevel !== "PUBLIC"` 时连 `certificate` 对象都不返回。
这里刻意区分两类「查不到」：`401/403` 是「你进不来」，`404 status=NOT_FOUND` 是
「你进来了，但这个验证码不存在」。

## 10. 已验证与未验证

**已验证**（都在隔离测试库 `climatepassport_test` + 127.0.0.1:3100 测试服务器上跑通，未碰开发库）：

- 单元测试 `npm test`：**610/610 通过**。含 `tests/open-api-auth.test.mjs`（bearer 形态矩阵、
  401/403/403 失败关闭矩阵、归因不对称、信封与 `x-request-id`、窗口键形态、匿名窗口不查库、
  两类窗口都带 `sensitive`、后端不可用 → 503、审计与错误体不含 key 材料）、
  `tests/external-decision-receipts.test.mjs`（新增 keyset 游标不漏读不重读，含同时间戳并列行）、
  `tests/source-ref-contracts.test.mjs`（新增「按来源系统自己的 Programme 划界」）、
  `tests/admin-channel-clients-page.test.mjs`（10 项源码级：仅 ADMIN、页面与组件都不得出现密钥列、
  清单必须服务端分页而非浏览器侧过滤、窄屏规则只能住在共享层、scope 目录只能来自 contracts、
  一次性明文只读回显、撤销后全控件禁用、配额成对提交、`{promptDialog}` 必须挂载）、
  `tests/admin-narrow-viewport-css.test.mjs`（5 项：`minmax(0, 1fr)` 轨道、`min-width: 0` 容器、
  控件 `max-width: 100%`、`.table-scroll` 与 `overflow-wrap: anywhere`，并断言单页样式表已删除）。
- 接口用例（真实数据库 + 真实凭据）：全量 **168 用例 = 162 通过 / 0 失败 / 6 显式 skip**（skip 为证书数据依赖）。
  `tests/api/open-api-key-api.test.ts`、
  `source-activity-mapping-api.test.ts`（13 项，含跨 Programme 抢占绑定 404）、
  `source-ref-contracts-api.test.ts`（4 项，双 Programme + 投影白名单断言）、
  `external-decision-receipts-api.test.ts`（含 `minimalJson` 不外发、游标翻页、`programmeId` 归属）、
  `activity-occurrences-api.test.ts`（分类登记/撤回 + 跨租户 404）、`publication-gateway-api.test.ts`、
  `channel-client-auth-api.test.ts` 的「清单分页」矩阵（page/pageSize/total、type 与关键词在服务端叠加、
  越界页空清单带回真实 total、6 类非法参数 400、每一页都不夹带密钥材料）。
- 浏览器验收 `npm run test:e2e`：全量 43 通过 + 14 既有显式 skip、0 失败。其中本页新增
  `tests/e2e/admin-channel-clients.spec.ts`（5 项）：门禁（ADMIN 进得去、EVENT_MANAGER 被重定向）、
  登记→明文即用→改策略→轮换（旧 key 当场 401 `API_KEY_INVALID`、新 key 200）→撤销（401 +
  原因落库 + 页面转只读）的金路、scope 硬门、清单分页（30 行按 25/页拆两页，跨页不重复也不漏，
  翻回第一页首行不变）、360/768/1024/1440 四屏宽两态无横向溢出；另有
  `tests/e2e/admin-narrow-viewport.spec.ts` 把 34 条 ADMIN 路由在 360px 下逐条量 `scrollWidth`，
  被 `overflow-x` 容器合法包住的元素不计为违规。
- `npx tsc --noEmit -p apps/passport-web/tsconfig.json` 0 错误。
- 规范自洽：`node artifacts/check-openapi.mjs` 解析 `docs/openapi/v1.yaml`，检查 `$ref` 悬挂、
  未声明 tag、重复 `operationId`，并把契约路径与 `app/api/v1/open/**/route.ts` 做双向对照
  （10 / 10 一致）。

**未验证 / 未做**：见下节。真实公网入口与边缘限流下的表现也没有实测（本地只有
`RATE_LIMIT_MODE=local` 路径）。

## 11. 仍未做的事

1. **清单分页与窄屏都已收口，行内审计轨迹还没有**：`/[locale]/admin/channel-clients`（决议第 6 条）
   的清单改为服务端分页 + 服务端筛选（参数见第 3 节），不再把历年用例留下的几百行塞进 DOM。
   窄屏也不再靠单页样式表打补丁：`styles/features/admin-channel-clients.css` 已删除，规则统一
   收口到共享 admin 布局层 `styles/shared/extended-components.css`，`/admin/messages` 那处 446px
   残留随之消失（`tests/admin-narrow-viewport-css.test.mjs` 5 项源码断言 + `tests/e2e/admin-narrow-viewport.spec.ts`
   把 34 条 ADMIN 路由在 360px 下逐条量 `documentElement.scrollWidth` 锁住了这一层）。
   仍未做的是行内审计展开——查一把 key 的
   变更史仍要去 `/admin/audit-logs`。
2. **开发库尚未应用本批迁移**：`20260921120000_channel_client_key_lifecycle` 只应用到隔离测试库，
   `prisma migrate status` 对开发库仍显示 44/45（本条 pending）。在获授权前不动开发库，
   所以开发环境跑 Open API 会因缺列而失败——这是有意的，不是遗漏。
   其余文档（`CURRENT_IMPLEMENTATION_STATUS.md`、`V21_CAPABILITY_TEST_TRACEABILITY.md`、
   `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`）已按「已并入 `/api/v1/open`」同步；
   历史日期条目里的 `/api/external/**` 路径保留为当时记录，未改写。
3. **规范落地方式**：`docs/openapi/v1.yaml` 没有代码生成、没有 CI 校验（`artifacts/check-openapi.mjs`
   是我这轮手写的一致性检查，未接入任何 workflow），`servers` 里的生产域名是占位。
4. **legacy `machineKeyHash` 的收口**：存量无盐 sha256 行仍可用，直到各自轮换。
   要不要给「未轮换的 legacy 行」设一个硬截止，属于运营决策。
5. `generateChannelClientKey` 的取模偏置**已改为拒绝采样**（`unbiasedLimit`，
   `lib/server/channel-client-auth.ts:260`）。留下的缺口是「分布均匀性没有度量」：函数未导出，
   测试只能从登记结果断言形态 `^CPK[A-Z0-9]{12}$`，采样的统计性质没有验证。

## 12. 怎么跑

```bash
# 单元测试（不需要服务器）
node --test tests/open-api-auth.test.mjs
npm test

# 单条接口用例（自带隔离服务器与测试库，会先清 outbound_dispatch）
node scripts/run-api-tests.mjs tests/api/open-api-key-api.test.ts

# 全量接口用例
npm run test:api

# 规范自洽 + 契约/路由一致性
node artifacts/check-openapi.mjs

# 管理台浏览器验收（自己拉起 127.0.0.1:3100 测试服务器；跑之前确认 3100 没被占用）
npm run test:e2e -- tests/e2e/admin-channel-clients.spec.ts
```

接口用例会往 `climatepassport_test` 留下租户、Programme、若干 MACHINE 客户端与审计行；
按 2026-09-21 决策第 6 条保留，不重置。
