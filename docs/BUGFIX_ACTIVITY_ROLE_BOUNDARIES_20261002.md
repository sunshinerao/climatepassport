# Activity A/P Role Boundaries

日期：2026-10-02 · 状态：本地实现与源码验证完成；未提交、未推送、未部署。

## 需求解读

按 FigJam「CP 角色与菜单权限」P0，EVENT_MANAGER（P）只能访问其负责且通过 Programme scope 授权的活动；活动创建、生命周期转换和核验员分配属于 ADMIN（A）。页面菜单隐藏不替代服务端鉴权。未映射的既有活动继续沿用现有 organizer 所有权行为。

## 修改方法

复用现有 Programme scope 断言和 API role guard；让列表与详情页使用相同的活动范围判定。用窄范围源码回归覆盖角色边界，并运行完整 Node 测试与 TypeScript 检查。

## 修改内容

- EVENT_MANAGER 活动列表在 organizer 归属过滤后，再按 `assertActivityScopeAccess(..., "read")` 过滤已映射活动。
- 活动状态转换 API 改为 ADMIN-only；详情工作台对 EVENT_MANAGER 隐藏状态转换、奖励规则和核验员分配入口。
- 核验员分配 API、独立管理页均改为 ADMIN-only；ADMIN 的全局管理行为保留。
- 更新 verifier authorization 回归，使其采用仓库的默认 role-auth 测试模拟器，并验证 EVENT_MANAGER 对自有及其他活动均被拒绝。

## 验证与边界

- `node --test tests/activity-security-boundaries.test.mjs`：10/10 通过。
- `node --test tests/figma-cp-activity-role-boundaries.test.mjs`：4/4 通过。
- `node --test tests/activity-verifier-authorization.test.mjs`：3/3 通过。
- `npm test`：852/852 通过；`npx tsc -p apps/passport-web/tsconfig.json --noEmit` 通过。
- 未运行真实数据库 API 或浏览器 E2E；当前工作区缺少隔离 API 测试环境配置。P 的证书审批/自动发证、S 的扫码验收及其余 API 页面授权矩阵仍未由本变更覆盖。