# 分 Programme 发布建议（CP-TODO-259 / CP-FR-073）

日期：2026-09-20 · 状态：本地开发与隔离测试基线 · **本建议不触发任何部署动作**；生产发布须另行授权并逐 programme 验收。

## 总体判断

V2.1 共享层（CP-TODO-240～258）已在本地开发库与隔离测试库交付并全量门禁通过（2026-09-20：npm test 551/551；test:api 143/143；e2e 37 通过 + 14 显式 skip；lint/build/db:validate 通过）。**当前不建议直接面向真实用户/真实未成年人发布**：生产环境验收（域名/cookie/邮件/对象存储/双 origin/真实双系统联调）尚属 CP-TODO-235，未执行。

## 发布门禁清单（每个 programme 上线前必须逐项勾选）

1. 发布范围内 API/E2E 零 skip（现有 14 项 e2e skip 为范围外占位，需明确不在本次范围）。
2. 44 项迁移在目标环境应用，且 dry-run 证据在案（`scripts/migration-dry-run.mjs` 输出 + `db:migrate:status` up to date）。
3. 备份恢复演练完成：隐私标记重放 runbook 走通（`OPERATIONS_RECOVERY_HANDOVER.md` §3），applied/skipped 数值留档。
4. 机器凭据发放与轮换计划确定；machine key 明文未落库核查。
5. 小样本抑制阈值与登录限流值经审批确认。
6. 回滚方案：迁移均为 additive，回滚=恢复应用前备份 + 重放隐私标记；演练一次。
7. 未验收功能入口保持关闭（FR-073）。

## SHCW（夏校渠道）

- **建议：维持冻结，仅做兼容回归**。v1 bridge/exchange/verify 无头路径字节级不变（243 批证据）；共享表结构全部 additive，既有行为未改（246 批未映射活动回归断言）。
- 接入面：现有 v1 契约继续可用；如需多期次/候补，走 246 的 opt-in occurrenceId 路径，不改旧流程。
- 前置：CP-TODO-235 真实环境验收（双 origin、真实域名 cookie/CSRF/回调/退出）。

## Future Stewards

- **建议：具备接入条件的 programme**。就绪面：records/assets/consents/publications（247～251）、decision receipts（250）、contribution facts（253）、sourceRef 契约与 SDK（252）、活动来源映射（245）、可靠 outbox（244）。
- FS 自研边界：Inquiry/Lab/学习写回/导师/编辑工作台在 FS 侧开发，经 sourceRef + 机器门面 + 回执对接，CP 不建业务模型（ADR V2.1）。
- 前置：235 验收 + 机器凭据发放 + inbox 侧校验（签名/时间窗/去重为接收方责任）+ 青年真实启用政策审批（249 门禁，未批准前不开放真实未成年人）。

## Convener 与其他 programme

- 席位/年度激活/Offer-Need/工单/Credit/Standing 均为外部自研（254/255/256 external）。CP 侧就绪面：身份与代表权（241/242）、决定回执（250）、贡献事实（253）、隐私生命周期（257）。
- 新 programme 接入流程：登记 Tenant/Programme/Edition → 登记 MACHINE ChannelClient（scope 按需）→ 契约对接 → 235 类真实验收 → 发布门禁清单。

## 发布顺序建议

1. CP 平台运维先完成生产环境准备与 235 验收（授权后）。
2. SHCW 兼容回归通过 → 保持现有服务级别。
3. FS 试点接入（只读契约先行：sourceRef + receipts），再开放写入面。
4. 其余 programme 按接入申请逐个过发布门禁。
