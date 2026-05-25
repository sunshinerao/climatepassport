# FEATURE_STYLE_SPLIT_DASHBOARD_REDESIGN_20260525

## 需求解读

- 按既定拆分顺序继续执行样式边界治理，在 Task 3 之后完成 Dashboard Redesign（Task 5）样式拆分。
- 本次目标是将 Dashboard 主题主样式从 `globals.css` 迁移到独立 feature 文件，降低全局样式耦合风险。
- 保持现有选择器语义和页面视觉行为不变，仅调整样式文件归属。

## 修改方法

- 基于注释锚点执行整段迁移：提取 Task 5 区块到独立文件，避免人工重写带来差异。
- 在 `globals.css` 的 feature import 区新增 Dashboard 样式导入，确保加载链路稳定。
- 删除 `globals.css` 对应 Dashboard 主体段，并修复边界过程中出现的局部结构断裂（`dash-feed` 段和注释头）。
- 完成后执行静态错误检查与回归测试，确认拆分稳定。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/dashboard-redesign.css`
  - 承载 Dashboard Redesign（Task 5）主样式块。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/dashboard-redesign.css";`
  - 删除 Task 5 主样式段。
  - 修复边界切分造成的 `.dash-feed-item` 块结构和 Task 4 区段注释头完整性。

- 校验结果：
  - `get_errors`：`globals.css` 与 `dashboard-redesign.css` 均无错误。
  - 选择器检查：`globals.css` 中仍有少量 `.dash-*` 响应式覆写（将在后续 responsive 回流阶段处理）。
  - 回归测试：`npm test` 结果 `38 passed / 0 failed`。
