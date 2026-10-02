# CP Governance Workbench Implementation Note

Date: 2026-10-02

## 需求解读

依据 `CP_BUSINESS_RULES.md` 和 `CP_GOVERNANCE_USER_GUIDE.md`，治理网页是明确未交付项。首阶段应给已授权 Programme 成员一个可读、可运维的界面，同时保持 scope 授权、双人审批、版本冻结和失败恢复仍由既有后端服务强制执行。不能借全局 ADMIN 身份扩大 Programme 可见性，也不能把该 UI 描述成五站机器联调或生产发奖。

## 修改方法

- 复用现有 `/api/governance` 读取与命令入口，不复制状态机或奖励逻辑。
- 增加项目列表读取时，候选集只来自有效的 whole-Programme membership；随后再次调用 `resolveScopedAccess` 判定 read/manage。
- 在登录后的用户工作台提供双语项目选择、状态、规则、来源及任务视图；操作按钮仅对 manage scope 显示，最终权限仍由 API 决定。
- 增加隔离服务级用例，覆盖 viewer/admin、撤权、edition-only membership。
- 同步业务规则状态、User Guide 与独立治理模块 tracker；明确未完成页面和生产边界。

## 修改内容

- 新增 `lib/server/governance-projects.ts`：返回最多 100 个当前可读项目的最小摘要，并附 read role/manage capability；全局角色不参与授权判定。
- 扩展 `GET /api/governance`：无 `projectId` 时返回授权项目列表，传 `projectId` 时保留既有详情读取行为。
- 扩展详情任务 projection 返回 `type`，供运营列表区分积分/徽章/证书任务。
- 新增 `/[locale]/dashboard/governance` 和 `GovernanceWorkbench`：项目详情、规则生命周期、来源摘要、奖励/冲正任务处理与重试，含加载/空/错误/只读状态。
- 在账户菜单增加 Programme 治理入口。
- 更新业务规则和 User Guide 状态说明，并新增 `docs/trackers/CP_GOVERNANCE_PENDING_FEATURES_TRACKER.md`。
- 当前未实现项目登记、来源/核验员配置、参与绑定和规则编辑器；未启用外部机器通道、自动 worker、生产发奖或生产部署。

## 验收记录

- `node --test tests/governance-projects.test.mjs`：2 passed，0 failed。
- `npx tsc -p apps/passport-web/tsconfig.json --noEmit`：通过。
- 专用真实治理数据库 `127.0.0.1:55432/cp_governance_test_20261001` 未配置；当前 `.env` 与 `.env.test` 指向不同数据库。因此未运行 `tests/api/governance.test.ts`，也未宣称真实 DB/API 浏览器验收完成。
- 未运行迁移、生产操作、提交或推送；其他既有工作树修改保持原样。