# FEATURE_STYLE_SPLIT_ADMIN_CERTIFICATE_MANAGEMENT_20260525

## 需求解读

- 按既定顺序继续样式拆分，在 Task 1 之后完成 Admin Certificate Management（Task 4）主样式迁移。
- 目标是将证书管理页的专属样式从 `globals.css` 抽离到 feature 文件，减少全局样式耦合。
- 本次不改样式语义与视觉，仅调整样式归属并保证功能回归稳定。

## 修改方法

- 采用注释锚点整段迁移，将 Task 4 区块完整提取到独立文件。
- 在 `globals.css` 的 feature import 区新增 Task 4 样式导入。
- 删除 `globals.css` 中 Task 4 主体段，并修复边界切分引入的注释残留。
- 执行错误检查、选择器分布核对和回归测试，确保拆分后稳定。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/admin-certificate-management.css`
  - 承载 Task 4 主体样式（`.cert-admin-*`、`.cert-mgr-*`、状态徽标样式等）。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/admin-certificate-management.css";`
  - 删除 Task 4 主样式段。
  - 修复 `Responsive overrides` 区段注释头。

- 校验结果：
  - `get_errors`：`globals.css` 与 `admin-certificate-management.css` 均无错误。
  - 选择器检查：`globals.css` 中仅保留响应式区段中的少量 `.cert-mgr-*` 覆写（后续 responsive 回流阶段处理）。
  - 回归测试：`npm test` 结果 `38 passed / 0 failed`。
