# CP Governance Pending Features Tracker

Last updated: 2026-10-02

范围依据：[CP业务规则主册](../CP_BUSINESS_RULES.md)与[治理User Guide](../CP_GOVERNANCE_USER_GUIDE.md)。本 tracker 仅记录 Climate Passport 通用治理能力；不接管各 Programme 的业务页面、审批队列或内容。

## Delivered locally

- [x] 治理项目读取 API 可列出调用者有权读取的项目；按有效 whole-Programme scope 过滤，edition-only、撤权、过期或仅全局 ADMIN 身份均不授予项目访问。
- [x] 登录后双语治理工作台显示授权项目、项目/规则状态、来源摘要和奖励任务。
- [x] 有 manage scope 的用户可通过既有治理命令批准/发布/退役项目或规则，并处理/重试奖励任务；服务端仍是授权与状态机真源。
- [x] `tests/governance-projects.test.mjs` 覆盖 Programme Viewer、Programme Admin、全局 ADMIN、撤权及 edition-only membership。

## Pending

- [ ] CP-GOV-UI-002 项目登记向导：机构/Programme 选择、机构 MANAGE 代表权校验、canonical unit 登记和来源权威范围说明。
- [ ] CP-GOV-UI-003 来源配置与核验员分配：登记 MACHINE 客户端、source app、issuer/audience、verifier，并逐字段显示权限边界。
- [ ] CP-GOV-UI-004 规则版本编辑器：严格类型化 condition/reward 表单、有效窗口、不可变版本预览和作者/审批者分离。
- [ ] CP-GOV-UI-005 参与绑定/核验操作：明确身份验证依据、ruleVersion pin 和不可逆 source record reference；不按 email 自动合并。
- [ ] CP-GOV-UI-006 任务运维深化：nextAttemptAt、失败详情安全投影、BLOCKED 原因与不可重试说明、批量恢复边界。
- [ ] CP-GOV-UI-007 浏览器验收：Programme Viewer/Operator/Admin scope 正反向矩阵、审批自审拒绝、移动端/键盘/zh-en、处理成功/失败状态。
- [ ] CP-GOV-INT-001 五站真实机器资格连接：按授权逐站签发 client/scope，完成真实环境合成验收；离线 fixtures 不算接入。
- [ ] CP-GOV-OPS-001 自动调度与生产启用：需另行批准 worker/调度、凭据管理、监控、恢复、迁移及部署，不属于本次页面交付。

## Explicit boundaries

- 页面可见与操作按钮不构成授权；所有命令继续经 `/api/governance` 和 `resolveScopedAccess`。
- 全局 ADMIN 不自动获得 Programme 业务权限。
- `app-outcome/1` 私密归档用途不扩展为奖励资格用途。
- GCA/FS 示例或离线验证不代表 GPTi、100cc、SHCW 2027 或五站真实机器通道已启用。
- 本次交付不触碰 Summer School、不部署生产、不创建外部 client/secret、不真实发奖。