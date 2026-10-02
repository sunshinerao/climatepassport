# V2.1 能力与测试溯源矩阵（CP-TODO-259 / CP-FR-073）

日期：2026-09-20（2026-09-21 增补「对外 Open API」一批：`/api/external/**` 已并入 `/api/v1/open/**`，并补上 ADMIN 凭据登记页 CP-TODO-260；同日后续批再增补「窄屏统一收口 + 凭据清单服务端分页」）· 性质：本地交付溯源；未部署生产 · 规则：每个能力可经「源码级断言 → 真实数据库 API 矩阵 → 浏览器 e2e」逐层重建证据。

## 门禁总览（最近批次）

| 批次 | 内容 | npm test | test:api | test:e2e | lint/build |
| --- | --- | --- | --- | --- | --- |
| 第七批 | CP-TODO-246 | 521/521 | 128/128 | —（37 通过+14 显式 skip 为当时基线） | 0 warn / ✓ |
| 第八批 | CP-TODO-253 | 529/529 | 133/133 | 同上 | ✓ |
| 第九批 | CP-TODO-257 | 540/540 | 141/141 | 同上 | ✓ |
| 第十批 | CP-TODO-252 | 545/545 | 144/144 | 同上 | ✓ |
| 第十一批 | CP-TODO-258 | 551/551 | 143/143 | 37 通过 + 14 显式 skip，0 fail | ✓ |
| 第十二批 | CP-TODO-259 | 本批 | 本批 | 本批 | ✓ |
| 2026-09-21 决议批 | 密钥生命周期/ bcrypt/ 来源约束/ 每 key 配额/ `/api/external` 并入 `/api/v1/open`/ ADMIN 凭据登记页（260） | 603/603 | 168 用例：161 通过、0 失败、7 显式 skip（证书数据依赖，本批未改 API 代码） | 41 通过 + 14 显式 skip，0 fail（含本批新增 `admin-channel-clients.spec.ts` 4 项） | lint ✓（0 警告）；`tsc --noEmit` 0 错误；build 未跑 |
| 2026-09-21 后续批 | 窄屏统一收口到共享 admin 布局层（删单页样式表）/ 凭据清单服务端分页 / 补 `DOCUMENT_CONVENTIONS.md` 与本批决议记录 / 清理临时探针 | 610/610 | 168 用例：162 通过、0 失败、6 显式 skip（证书数据依赖；同批修掉 `reliable-dispatch` 的 `forceDue` 排队缺陷，此前全量跑红 2 项） | 43 通过 + 14 显式 skip，0 fail（本批新增窄屏逐路由 1 项、清单分页 1 项） | lint ✓（0 警告）；`tsc --noEmit` 0 错误；build 未跑 |

e2e 的 14 项 skip 为既有显式占位（缺运行时 fixture 的功能），按 FR-073「未验收功能保持关闭」保留，不计入通过。

## 能力 → 证据矩阵

| 能力（CP-TODO / FR） | 服务与门面 | 源码级断言 | 真实数据库 API | 浏览器 e2e |
| --- | --- | --- | --- | --- |
| 240 字段所有权 ADR（050/051/053/071） | `docs/FIELD_OWNERSHIP_AND_SCOPE_ADR_V21_20260919.md` | 文档存在性与范围保护断言（各批源码测试引用） | — | — |
| 241 scope 基座（050/051） | `programme-scope.ts`；`/api/activities/[id]/institutions` | `tests/programme-scope-service.test.mjs`（14） | `tests/api/programme-scope-authorization.test.ts`（15 矩阵） | — |
| 242 治理（051/052） | `person-institution-governance.ts` | `tests/person-institution-governance.test.mjs`（9） | `tests/api/person-institution-governance-api.test.ts` | — |
| 243 机器认证（069/073） | `channel-client-auth.ts`；v1 verify 分支；`open-api-auth.ts`（bearer 门面同一套判定） | `tests/channel-client-auth.test.mjs`（10）、`tests/open-api-auth.test.mjs`（21） | `tests/api/channel-client-auth-api.test.ts`、`tests/api/open-api-key-api.test.ts` | 260 批凭据登记页 |
| 260 ADMIN 凭据登记页（069） | `/[locale]/admin/channel-clients`；`admin-channel-clients-manager.tsx`；窄屏规则在共享层 `styles/shared/extended-components.css`（单页样式表 `styles/features/admin-channel-clients.css` 已删除） | `tests/admin-channel-clients-page.test.mjs`（10，含「密钥列不得出现在页面/组件」「清单必须服务端分页而非浏览器侧过滤」「一次性明文只读回显」「{promptDialog} 必须挂载」） | 复用 243 的四个 admin 路由真实库矩阵（`tests/api/channel-client-auth-api.test.ts`）+ 本批「清单分页」矩阵（page/pageSize/total、type 与关键词服务端叠加、越界空页、6 类非法参数 400）；能力面仍是那四个路由，本批只把清单查询参数化 | `tests/e2e/admin-channel-clients.spec.ts`（5：门禁 / 登记→改策略→轮换→撤销金路 / scope 硬门 / 分页两页不重不漏 / 四屏宽两态） |
| 244 可靠 outbox（070） | `reliable-dispatch.ts` | `tests/reliable-dispatch.test.mjs`（7） | `tests/api/reliable-dispatch-api.test.ts`（进程内 HTTP 接收器） | — |
| 245 来源映射执行（053） | `source-activity-mapping.ts`；`/api/v1/open/activity-mappings/*` | `tests/source-activity-mapping.test.mjs`（25） | `tests/api/source-activity-mapping-api.test.ts`（13） | — |
| 246 期次/原子录取/候补（054/055） | `activity-occurrences.ts`；review 原子路径 | `tests/activity-occurrences.test.mjs`（14） | `tests/api/activity-occurrences-api.test.ts` | — |
| 247 私密记录（057/071） | `private-records.ts`；`/api/records` | `tests/private-records.test.mjs`（8） | `tests/api/private-records-api.test.ts` | 258 批 records 页 |
| 248 受控 Asset（058） | `controlled-assets.ts` | `tests/controlled-assets.test.mjs`（19） | `tests/api/controlled-assets-api.test.ts` | — |
| 249 同意（060） | `consents.ts`；`/api/consents` | `tests/consents.test.mjs`（12） | `tests/api/consents-api.test.ts` | 258 批 consents 页 |
| 250 外部决定回执（059） | `external-decision-receipts.ts`；`/api/v1/open/decision-receipts`（提交 + 游标分页回读） | `tests/external-decision-receipts.test.mjs`（12） | `tests/api/external-decision-receipts-api.test.ts` | — |
| 251 Publication 网关（061/068） | `publication-gateway.ts` | `tests/publication-gateway.test.mjs`（14） | `tests/api/publication-gateway-api.test.ts` | — |
| 252 sourceRef 契约（071/072） | `source-ref-contracts.ts`；`/api/v1/open/source-refs/resolve`；SDK `resolveSourceRef` | `tests/source-ref-contracts.test.mjs`（6） | `tests/api/source-ref-contracts-api.test.ts`（FS 模拟） | — |
| 253 贡献事实（062） | `contribution-facts.ts`；`/api/contributions` | `tests/contribution-facts.test.mjs`（8） | `tests/api/contribution-facts-api.test.ts` | — |
| 257 通知重试/报告/删除/回放（066/067/068） | `notification-delivery.ts` / `privacy-reports.ts` / `privacy-lifecycle.ts` | `tests/notification-privacy.test.mjs`（11） | `tests/api/notification-privacy-api.test.ts`（真实邮件 outbox） | 258 批 account-data 页 |
| 258 CP 页面与 UI 组件（072/073） | `@climate-passport/passport-ui-flows`；三个 dashboard 页 | `tests/cp-ui-flows.test.mjs`（6） | — | `tests/e2e/cp-data-governance.spec.ts`（10） |
| 既有安全整改（CP-AUD-001/002/005/006） | `certificate-verification.ts`、证书审核事务 | `tests/certificate-verification-service.test.mjs` 等 | `tests/api/certificate-verification-authorization.test.ts`、`certificate-application-review-api.test.ts` | `certificate-artifact-security.spec.ts` 等 |

## 反例与并发覆盖（FR-073 要求）

- **scope 反例**：241 跨 Programme/跨 Edition/未知 scope/全局 ADMIN/VIEWER 写/撤权即时；243 origin/scope/撤销矩阵；245 跨 Programme 寻址 404；252 未知系统 404。对外 Open API 另加三类：跨 Programme 的活动写入一律 404（已接入的活动不可抢占）、`allowedOrigins` 为空时带 Origin 的调用 403 `API_KEY_ORIGIN_DENIED`（空白名单不再等于放行）、外来 key 解析他租户 institution/activity/record 得 404 而 `person` 仍 200（全局身份 + 白名单投影）。
- **撤回并发**：247 CAS 409 且不覆盖（payload 证明）；249 撤回即时阻断发布（CONSENT_WITHDRAWN 分码）；251 撤回版本禁止复活；253 更正/撤回即时复算统计；246 满员 409 与并发确认恰好满额。
- **故障恢复**：244 退避→死信→管理端重投 + 对账旧 revision 拒绝；257 通知死信与备份隐私标记幂等重放（恢复先重放再开放读取）；迁移 dry-run（`scripts/migration-dry-run.mjs`，2026-09-21 复跑：空库 45 迁移干净应用、118 张表、`prisma validate` 通过、scratch 库已删除）。

## 使用方式

任何能力的验收质疑按矩阵回到最左可执行证据；所有测试可用根目录 `npm test` / `npm run test:api` / `npm run test:e2e` 复跑（e2e 需 `.env.test.local` 指向隔离库）。生产分层验收（真实域名/双 origin/邮件/对象存储）属于 CP-TODO-235 真实环境验收，另行授权执行。
