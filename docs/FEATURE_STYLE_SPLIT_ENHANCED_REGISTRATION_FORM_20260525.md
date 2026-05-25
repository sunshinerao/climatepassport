# FEATURE_STYLE_SPLIT_ENHANCED_REGISTRATION_FORM_20260525

## 需求解读

- 按确认顺序完成本轮最后一项样式拆分：Enhanced Registration Form（Task 2）。
- 目标是把注册增强表单主样式从 `globals.css` 移至独立 feature 文件，持续收缩全局样式职责。
- 保持功能行为和视觉输出不变，仅变更样式归属。

## 修改方法

- 使用注释锚点整段提取方式迁移 Task 2 区块到新文件。
- 在 `globals.css` 头部 feature imports 中接入新样式文件。
- 从 `globals.css` 清理 Task 2 主样式段，保留响应式段中必要覆写项（后续统一回流处理）。
- 完成后执行错误检查、选择器核对与回归测试。

## 修改内容

- 新增文件：`apps/passport-web/app/styles/features/enhanced-registration-form.css`
  - 承载 Task 2 主样式：`.field-row`、`.field-row-3`、`.form-section-head`、`.form-section-toggle` 等。

- 修改文件：`apps/passport-web/app/globals.css`
  - 新增导入：`@import "./styles/features/enhanced-registration-form.css";`
  - 删除 Task 2 主样式段。

- 校验结果：
  - `get_errors`：`globals.css` 与 `enhanced-registration-form.css` 均无错误。
  - 选择器检查：`globals.css` 中仍保留响应式覆写中的 `.field-row/.field-row-3`（后续 responsive 回流阶段统一迁移）。
  - 回归测试：`npm test` 结果 `38 passed / 0 failed`。
