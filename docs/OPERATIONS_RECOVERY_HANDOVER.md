# 运营与恢复交接手册（CP-TODO-259 / CP-FR-073）

日期：2026-09-20 · 范围：Climate Passport 数字基座本地交付的运维交接 · **本文档不构成部署授权**；生产动作一律另行审批。

## 1. 环境分层

| 层 | 配置 | 用途 | 数据 |
| --- | --- | --- | --- |
| 本地开发 | `.env` → 本地 Postgres | 开发/手工验收 | 可重建 |
| 隔离测试 | `.env.test(.local)`，`CP_TEST_ENV_ID=climate-passport-isolated-test`、`NODE_ENV=test`、`MAIL_TRANSPORT=test-outbox` | `npm run test:api` / `test:e2e`（runner 强制与开发库不同库） | 用后不清，跨运行累积；`run-api-tests.mjs` 启动前清 `outbound_dispatch` |
| 生产 | 未部署（截至 2026-09-20） | — | — |

## 2. 责任矩阵（有负责人=角色 Owner，落实到人时按现任分工填写）

| 事项 | CP 平台运维 | CP 安全 | Programme 运营 | Programme 技术 |
| --- | --- | --- | --- | --- |
| 环境/可用性 | **R**：迁移应用、批处理任务、死信处理 | C | I | C（对接环境） |
| 接口契约 | **R**：contracts/SDK 版本与错误码兼容 | C | I | **R**：按契约接入、inbox 校验（签名/时间窗/去重） |
| 数据责任 | C | **R**：审计、脱敏、保留与删除策略执行 | **R**：业务数据正确性、决定回执/来源版本内容 | C |
| 支持升级 | **R**：平台级故障一线；升级窗口见 §5 | **R**：安全事件响应 | **R**：业务规则与措辞问题 | C |
| 监控 | **R**：§4 指标与告警接入 | C | I | I |
| 备份演练 | **R**：定期恢复演练（§3 runbook） | C | I | I |

## 3. 备份恢复 runbook（含隐私标记重放）

1. **恢复数据库**到目标点（平台运维执行，记录时间点与来源备份）。
2. **先重放撤回/删除标记，再开放读取**：`POST /api/admin/privacy/replay-markers`（ADMIN；可带 `{ "subjectType": "User" }` 分批）。预期：已生效标记全部 `skipped`（幂等）；恢复带入的旧状态被重新匿名化/撤回，`applied > 0`。
3. **验证**：抽查被删账户不可登录（SUSPENDED + 匿名化邮箱 `deleted-<hash>@anonymized.invalid`）；抽查本人 ACTIVE 记录仍为 WITHDRAWN。
4. **开放读取**前确认 2–3 通过；全程写审计（动作 `PRIVACY_MARKERS_REPLAYED`）。
5. 演练记录：日期、执行人、replayed/applied/skipped 数值、抽查结论。

## 4. 运行手册与监控点

- **出站事件（reliable-dispatch）**：`POST /api/admin/dispatches/process` 批处理；`GET /api/admin/dispatches` 监控 `DEAD` 行；`POST /[id]/retry` 仅 DEAD 可重投；对账 `POST /[id]/reconcile`（旧 revision 一律拒绝）。告警建议：`DEAD` 数 > 0 持续 15 分钟。
- **通知投递**：`POST /api/admin/notifications/process`；`deadLetteredAt` 非空即死信（含偏好关闭的 SKIPPED）；邮件只发标题+定位链接，私密正文不外发。
- **受控资产**：`scanStatus=INFECTED` 进隔离区，管理端检疫路由处理；存储完整性靠内容哈希回读校验。
- **登录限流**：`RATE_LIMIT_AUTH_LOGIN_LIMIT/WINDOW_MS`（默认 8/5min，仅环境可调）。
- **审计入口**：`core_audit_logs` 关键动作：`source_mapping.*`、`activity_taxonomy.*`、`contribution.*`、`account.delete`、`PRIVACY_MARKERS_REPLAYED`、`outbound_dispatch.requeue/reconcile`、`NOTIFICATION_DELIVERY_PROCESS`、`ACTIVITY_APPLICATION_REVIEWED`、`ACTIVITY_ATTENDANCE_CORRECTED`。
- **隐私报告阈值**：`CP_PRIVACY_REPORT_MIN_CELL`（默认 5）——**审批后才能调整**，调整后需记录。

## 5. 支持升级边界

- CP 平台：认证/scope/契约/outbox/隐私基座的可用性与安全。
- Programme：通知触发与措辞、业务审核队列、分类/立项规则、inbox 侧校验——CP 不判断支持是否逾期（CP-FR-066）。
- 安全事件（凭据泄漏、可疑审计模式）：CP 安全立即吊销相关 ChannelClient（`POST /api/admin/channel-clients/[id]/revoke`，即刻 401）并轮换。后台入口 `/[locale]/admin/channel-clients`（仅 ADMIN）已把登记/改策略/轮换/撤销接成表单，撤销与轮换都强制填原因；页面上的清单只给 `machineKeyConfigured`/`machineKeyAlgorithm`/到期与最近使用时间，取不到任何密钥材料。

## 6. 密钥与凭据

- 机器密钥只存 sha256 摘要；明文仅在登记响应出现一次，**不得入库/入日志**。
- `RESEND_API_KEY`、数据库 URL、限流 REST Token 仅存环境/密钥管理；测试库 outbox 文件权限 0600。
- 轮换周期：机器凭据按 programme 接入批次轮换；泄露即吊销重发。

## 7. 迁移管理

- 全部迁移 additive（夏校冻结兼容）；新迁移必须附源码级 + 真实库矩阵证据。
- 目标环境应用前在 scratch 库 dry-run：`node scripts/migration-dry-run.mjs`（空库全量应用 + validate + 自动清理，2026-09-21 实跑 45 迁移/118 表通过）。
- 应用后 `npm run db:migrate:status` 必须为 up to date。
