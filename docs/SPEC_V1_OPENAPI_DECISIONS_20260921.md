# Open API v1 决议记录（2026-09-21）

日期：2026-09-21 · 状态：本批已落地，改动全部未提交 · 性质：决策台账，落笔即冻结（见 [文档维护约定](DOCUMENT_CONVENTIONS.md) §4）。

本文只记「问了什么、拍成什么、落在哪里、还欠什么」。契约与设计理由在
[`OPEN_API_V1_zh.md`](OPEN_API_V1_zh.md)，机器可读契约在 [`openapi/v1.yaml`](openapi/v1.yaml)，
逐能力证据在 [`V21_CAPABILITY_TEST_TRACEABILITY.md`](V21_CAPABILITY_TEST_TRACEABILITY.md)。

## 决议怎么来的

上一轮交付后我列了 7 个待拍板项，用户逐条答复；其中第 4、6 条答复是「不明白是什么意思」，
解释清楚后用选择题重拍，因此本表同时记原话与最终口径。第 3、5 条也各有一次二次确认。

## 七条决议

| # | 我提的问题 | 用户决议（原话） | 最终口径与落地 |
| --- | --- | --- | --- |
| 1 | `ChannelClient` 只有 `isActive`，没有过期/轮换/撤销原因，做生命周期要加列，按规则不擅自迁移 | 「密钥生命周期要进行管理」 | 迁移 `20260921120000_channel_client_key_lifecycle`（纯新增 10 列 + 过期时间索引 + 回填 `machineKeyIssuedAt`）；`machineKeyIssuedAt/ExpiresAt/RotatedAt/LastUsedAt`、`revokedAt`、`revokeReason` |
| 2 | machine key 存的是无盐 sha256 | 「换bcrypt/argon2」 | 带随机盐 bcrypt 列 `machineKeyBcrypt`；`whoami` 与清单用 `algorithm: "bcrypt" \| "sha256-legacy"` 标出存量；旧摘要列只在该 key 轮换前可读，轮换即清空 |
| 3 | bearer 形态不校验 `allowedOrigins`，是省掉 `clientKey` 的代价 | 「对Open API强制origin」→ 二次确认选「浏览器来源强校验 + IP 白名单」 | 凭据改为 `Bearer <clientKey>.<machineKey>`（自带定位信息，因为盐随机 ⇒ 无法按摘要反查）。带 `Origin` 即判为浏览器，必须命中该 key 的 `allowedOrigins`（空表 ⇒ 403 `API_KEY_ORIGIN_DENIED`）；不带 `Origin` 走服务端到服务端，按 `allowedIps` CIDR 判（403 `API_KEY_IP_DENIED`）；IP 不可归因且白名单非空 ⇒ **失败关闭**；`x-forwarded-for` 仅在 `RATE_LIMIT_TRUST_PROXY=true` 时采信 |
| 4 | 配额硬编码 60/分钟，没有按 key 配置列 | 「这点不明白是什么意思」→ 解释后选「每把 key 可配」 | `rateLimitLimit` / `rateLimitWindowMs` 逐 key 可配，边界 `RATE_LIMIT_BOUNDS`（1–100000 次、1s–1h）；`MACHINE_KEY_MAX_VALID_DAYS = 730`。管理台**成对提交**这两个字段，只发一项会把另一项悄悄重置 |
| 5 | `/api/external/**` 8 个路由未并入，信封不统一、无 request id、无分页 | 「全部并入，你要知道这个open API提供的能力是需要能够支撑多个programme的使用的，不是在CP内部使用」→ 二次确认选「直接删除，只留 /api/v1/open」 | 8 个旧端点整体并入并**删除、不留别名**；`/api/v1/open/**` 现有 10 条路由与 `v1.yaml` 的 10 路径 / 21 操作一一对应。合并时补了三件旧端点都没有的事：`x-request-id` 贯穿全部响应、统一 `{error:{code,message,requestId}}` 信封、列表游标分页（`OpenApiPageMetaSchema`）。**不复制「无凭据退回公开行为」这条分支** |
| 6 | 无 ADMIN 后台页面，登记/撤销只能调 API | 「不明白什么意思」→ 解释后选「建页面」 | `/[locale]/admin/channel-clients`（CP-TODO-260），四个管理路由全接上：`GET/POST /api/admin/channel-clients`、`PATCH /api/admin/channel-clients/[id]`、`POST .../[id]/rotate-key`、`POST .../[id]/revoke`。一次性明文只回显一次；页面自身是四个路由的纯客户端 |
| 7 | `generateChannelClientKey` 的 `% 36` 取模偏置要不要改 | 「改」 | 改为拒绝采样（`unbiasedLimit`，`lib/server/channel-client-auth.ts:260`） |

## 决议 5 引出的两条硬规则

「支撑多个 programme、不是在 CP 内部使用」不是措辞，它改变了授权前提：旧端点靠 `clientKey`
天然隔离租户，对外之后同一把 key 的能力必须按 Programme 划范围。

- **跨租户口径**：`Activity` 与 `Programme` 只经 ACTIVE `SourceObjectMapping` 关联，
  `Institution` 只经 ACTIVE `InstitutionRepresentation` 关联。
- **探测一律 404，不给 403**：资源属于别的 programme 时返回 404。返回 403 等于承认
  「这个 ID 存在但不给你」，对外就是一个 ID 探测面。

## 本批交付时的门禁（实跑，非引用）

| 检查 | 结果 |
| --- | --- |
| `npm test` | 603 通过 / 0 失败 |
| `npm run test:api` | 168 用例：161 通过 / 0 失败 / 7 显式跳过（跳过数随测试库遗留状态摆动） |
| `npm run test:e2e`（全量） | 41 通过 + 14 既有显式 skip / 0 失败 |
| `npx tsc -p apps/passport-web/tsconfig.json --noEmit` | 0 error |
| `npm run lint` | 无告警无错误 |
| `node artifacts/check-openapi.mjs` | 10/10 |

环境口径：开发库刻意停在 `44/45`，决议 1 的迁移只应用到 `climatepassport_test`；未提交、未推送、未部署。

## 同日追加的四条决议

1. **窄屏溢出统一收口**：不在 `admin-channel-clients` 单页打补丁，改共享 admin 布局层
   （`/admin/messages` 在 360px 下 `documentElement.scrollWidth` 为 446px 是既有债务）。
2. **ADMIN 凭据清单要服务端分页**：当前清单一次性渲染全部行、筛选与搜索在浏览器侧做，
   隔离测试库已躺着几百行历年用例留下的客户端。
3. **补齐两份文档**：`DOCUMENT_CONVENTIONS.md`（本文所属的写作规则）与本文。
   说明：此前有条「某个 hook 引用了这两份文档」的记录我无法证实——`~/.qoder-cn/settings.json`
   只有 `enabledPlugins` 与 `mcpServers`、没有 `hooks`，仓库内也 grep 不到这两个文件名。
   文件按决议本身补齐，不依附于那个说法。
4. **其余临时件清掉**：`artifacts/` 下我这轮的一次性探针脚本删除，
   `artifacts/check-openapi.mjs` 保留（被多份文档引用为可复跑检查）。

## 四条决议的落地情况（同日，本次实跑复核）

上面四条原文不改；这里只记落点与证据。

| 决议 | 落点 | 证据 |
| --- | --- | --- |
| 1 统一收口 | 共享层 `app/styles/shared/extended-components.css` 与 `app/globals.css`：网格轨道改 `minmax(0, 1fr)`、断点同步、布局项钉 `min-width: 0`、表单控件与滚动容器不再定页宽、`.section-header` 允许换行、补上此前无人定义的 `.table-scroll`、`overflow-wrap: anywhere`；`/admin/messages` 的 446px 一并闭合 | `tests/admin-narrow-viewport-css.test.mjs`（5 项源码级锁定共享层形状）+ `tests/e2e/admin-narrow-viewport.spec.ts`（34 条 ADMIN 路由 × 360×800 逐页量 `documentElement.scrollWidth`） |
| 2 服务端分页 | `app/api/admin/channel-clients/route.ts`：zod 收 `page`/`pageSize`/`search`，`Promise.all([findMany({skip,take}), count({where})])`，排序 `createdAt desc, id asc`（`createMany` 行共享同一 `createdAt`，无并列键会漏读重读），响应带 `pagination`；`components/admin-channel-clients-manager.tsx` 删掉浏览器侧 `visible` 过滤，改为提交式搜索 + 上一页/下一页 | `tests/admin-channel-clients-page.test.mjs`（8→10 项）+ `tests/api/channel-client-auth-api.test.ts` 新增「不重不漏、服务端筛选、越界空页与非法参数 400」+ `tests/e2e/admin-channel-clients.spec.ts`（4→5 项，30 行真数据翻页） |
| 3 补文档 | `docs/DOCUMENT_CONVENTIONS.md`、本文；`docs/README.md` 已登记两处 | 文件在库中，本段即按前者的「长期文档改期、一次性记录只增不改」规则书写 |
| 4 清临时件 | `artifacts/` 下本轮一次性探针脚本删除，`check-openapi.mjs` 保留 | `node artifacts/check-openapi.mjs` 仍 10/10 |

补一条本批发现的非产品缺陷：`tests/api/reliable-dispatch-api.test.ts` 的 `forceDue` 只把行推到
「1 秒前」，而并发用例会在同一轮往池子堆上千条到期行（实测测试库 1585 行、1582 PENDING 且全部到期），
认领顺序是 `nextRetryAt asc` 且路由 `limit` 封顶 50，本行始终排在队伍末尾 → 单独跑绿、全量跑红。
改为置 `new Date(0)` 抢在最前。属于测试调度问题，不是发信逻辑问题。

本批重跑门禁：`npm test` **610/610**；`npm run test:api` **168 用例 = 162 通过 / 0 失败 / 6 显式 skip**；
`npm run test:e2e` **43 通过 + 14 既有显式 skip / 0 失败**；`tsc --noEmit` 0 error；`npm run lint` 干净。
仍未提交、未推送、未部署，开发库仍停在 `44/45`。
